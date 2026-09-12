import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GestureAdapter} from './gesture-adapter.js';
import {WindowManager} from './window-manager.js';

export default class SwipeDownGestureExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._windowManager = new WindowManager(this._settings);
        this._gesture = new GestureAdapter(
            this._settings,
            fingerCount => this._windowManager.handleSwipeDown(fingerCount));

        // The adapter also checks this mode for every gesture update. NORMAL
        // is a bit flag in Shell.ActionMode, not a standalone state value.
        this._gesture.start(Shell.ActionMode.NORMAL);
    }

    disable() {
        this._gesture?.destroy();
        this._gesture = null;

        // Destroy deliberately forgets sessions; it never restores windows.
        this._windowManager?.destroy();
        this._windowManager = null;

        if (this._settings && typeof this._settings.run_dispose === 'function')
            this._settings.run_dispose();
        this._settings = null;
    }
}
