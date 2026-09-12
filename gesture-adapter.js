import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const GestureState = {
    IDLE: 0,
    PENDING: 1,
    IGNORED: 2,
};

const FOCUSED_FINGER_COUNT = 3;
const ALL_FINGER_COUNT = 4;
const DIRECTION_RATIO = 1.25;

/**
 * Observes Mutter's existing touchpad swipe stream without consuming it.
 * Clutter.Event.add_filter() is the earliest GNOME 50 hook; the signal
 * fallback is retained for builds where the GI method is unavailable.
 */
export class GestureAdapter {
    constructor(settings, onSwipeDown) {
        this._settings = settings;
        this._onSwipeDown = onSwipeDown;
        this._state = GestureState.IDLE;
        this._totalX = 0;
        this._totalY = 0;
        this._qualified = false;
        this._fingerCount = 0;
        this._filterId = 0;
        this._stageSignalId = 0;
        this._settingsSignalIds = [];
        this._allowedMode = Shell.ActionMode.NORMAL;

        for (const key of ['enable-gesture']) {
            this._settingsSignalIds.push(
                this._settings.connect(`changed::${key}`, () => this._cancel()));
        }
    }

    start(allowedMode) {
        this._allowedMode = allowedMode;

        try {
            if (typeof Clutter.Event.add_filter === 'function' &&
                typeof Clutter.Event.remove_filter === 'function') {
                this._filterId = Clutter.Event.add_filter(
                    global.stage, this._eventFilter.bind(this));
                return;
            }
        } catch (error) {
            log(`Swipe Down Gesture: event filter unavailable: ${error}`);
        }

        // This still returns EVENT_PROPAGATE and therefore does not compete
        // with GNOME's native Overview swipe tracker.
        // Touchpad gestures are commonly claimed by Shell's swipe tracker
        // before the event reaches the normal bubbling phase.  Observe them
        // during capture instead, while continuing to propagate every event
        // so the tracker retains control of the built-in swipe-up gesture.
        this._stageSignalId = global.stage.connect(
            'captured-event', (_actor, event) => {
                this._handleEvent(event);
                return Clutter.EVENT_PROPAGATE;
            });
    }

    _eventFilter(event) {
        this._handleEvent(event);
        return Clutter.EVENT_PROPAGATE;
    }

    _isNormalDesktop() {
        if ((Main.actionMode & this._allowedMode) === 0)
            return false;

        const overview = Main.overview;
        if (!overview)
            return false;

        // visible covers both the window picker and app grid. The target and
        // animation checks avoid acting during an Overview transition.
        return !overview.visible && !overview.visibleTarget &&
            !overview.animationInProgress;
    }

    _handleEvent(event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return;

        const phase = event.get_gesture_phase();
        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._reset();
            const fingerCount = event.get_touchpad_gesture_finger_count();
            if (!this._settings.get_boolean('enable-gesture') ||
                ![FOCUSED_FINGER_COUNT, ALL_FINGER_COUNT].includes(fingerCount) ||
                !this._isNormalDesktop()) {
                this._state = GestureState.IGNORED;
                return;
            }

            this._fingerCount = fingerCount;
            this._state = GestureState.PENDING;
        }

        if (this._state !== GestureState.PENDING)
            return;

        if (event.get_touchpad_gesture_finger_count() !== this._fingerCount ||
            !this._isNormalDesktop()) {
            this._cancel();
            return;
        }

        if (phase === Clutter.TouchpadGesturePhase.CANCEL) {
            this._cancel();
            return;
        }

        // Gesture motion uses stage coordinates, where Y increases downward.
        // Natural-scroll settings do not affect the physical swipe direction.
        const [dx, dy] = event.get_gesture_motion_delta_unaccelerated();
        this._totalX += dx;
        this._totalY += dy;

        const horizontal = Math.abs(this._totalX);
        const vertical = Math.abs(this._totalY);
        if (this._totalY < 0 || horizontal > vertical * DIRECTION_RATIO) {
            this._cancel();
            return;
        }

        // Deliberately no distance threshold: a completed, predominantly
        // downward three- or four-finger swipe is sufficient for the action.
        this._qualified = this._totalY > 0 &&
            this._totalY > horizontal * DIRECTION_RATIO;

        // Do not change window state when the threshold is merely crossed:
        // only a complete, qualifying gesture is actionable.
        if (phase === Clutter.TouchpadGesturePhase.END) {
            if (this._qualified)
                this._onSwipeDown(this._fingerCount);
            this._reset();
        }
    }

    _cancel() {
        this._state = GestureState.IGNORED;
        this._totalX = 0;
        this._totalY = 0;
        this._qualified = false;
        this._fingerCount = 0;
    }

    _reset() {
        this._state = GestureState.IDLE;
        this._totalX = 0;
        this._totalY = 0;
        this._qualified = false;
        this._fingerCount = 0;
    }

    destroy() {
        this._cancel();

        if (this._filterId && typeof Clutter.Event.remove_filter === 'function') {
            try {
                Clutter.Event.remove_filter(this._filterId);
            } catch (error) {
                log(`Swipe Down Gesture: could not remove event filter: ${error}`);
            }
        }
        this._filterId = 0;

        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = 0;
        }

        for (const id of this._settingsSignalIds)
            this._settings.disconnect(id);
        this._settingsSignalIds = [];
    }
}
