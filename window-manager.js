import Meta from 'gi://Meta';

const ALL_FINGER_COUNT = 4;

/**
 * Performs only native Meta.Window minimize/unminimize operations. Window
 * objects are private Mutter references, so every later use is guarded.
 */
export class WindowManager {
    constructor(settings) {
        this._settings = settings;
        this._sessions = new Map();
    }

    handleSwipeDown(fingerCount) {
        const workspace = global.workspace_manager.get_active_workspace();
        const visibleWindows = this._eligibleWindows(workspace);
        const focused = global.display.focus_window;
        const candidates = fingerCount === ALL_FINGER_COUNT
            ? visibleWindows
            : focused && visibleWindows.includes(focused) ? [focused] : [];
        let session = this._sessions.get(workspace);

        // A visible window always takes priority over restoring the session.
        // This covers the common case where the user brings one hidden window
        // back from the dock and then swipes down to hide it again.
        if (candidates.length > 0) {
            if (!session)
                session = this._createSession(workspace);

            for (const window of candidates)
                this._minimizeForSession(session, window);

            if (session.entries.size === 0) {
                this._disconnectSession(session);
                this._sessions.delete(workspace);
            }
            return;
        }

        // A three-finger swipe with no eligible focused window must not reveal
        // hidden windows while another application is still visible.
        if (visibleWindows.length > 0)
            return;

        // Restore only when the desktop is already clear.
        if (session && this._settings.get_boolean('restore-on-second-swipe'))
            this._restore(workspace, session);
    }

    _createSession(workspace) {
        const session = {
            workspace,
            entries: new Map(),
            previouslyFocused: global.display.focus_window,
            workspaceSignalId: 0,
        };
        this._sessions.set(workspace, session);

        try {
            session.workspaceSignalId = workspace.connect(
                'window-removed', (_workspace, window) =>
                    this._removeWindow(session, window));
        } catch (error) {
            // Per-window "unmanaged" below remains the normal cleanup path.
            log(`Swipe Down Gesture: workspace lifecycle signal unavailable: ${error}`);
        }
        return session;
    }

    _eligibleWindows(workspace) {
        let windows;
        try {
            windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
        } catch (error) {
            log(`Swipe Down Gesture: could not enumerate windows: ${error}`);
            return [];
        }

        return windows.filter(window => this._isEligible(window, workspace));
    }

    _isEligible(window, workspace) {
        try {
            if (typeof window?.can_minimize === 'function' && !window.can_minimize())
                return false;

            const overrideRedirect = typeof window?.is_override_redirect === 'function'
                ? window.is_override_redirect()
                : window?.override_redirect === true;
            const locatedOnWorkspace = typeof window?.located_on_workspace === 'function'
                ? window.located_on_workspace(workspace)
                : typeof window?.get_workspace === 'function' &&
                    window.get_workspace() === workspace;
            if (!this._isManaged(window) ||
                window.minimized || window.skip_taskbar ||
                window.get_transient_for() ||
                overrideRedirect ||
                !locatedOnWorkspace ||
                !window.showing_on_its_workspace()) {
                return false;
            }
            return true;
        } catch (_error) {
            return false;
        }
    }

    _minimizeForSession(session, window) {
        if (!session.entries.has(window)) {
            const entry = {window, signalIds: []};
            session.entries.set(window, entry);

            try {
                entry.signalIds.push(window.connect(
                    'unmanaged', () => this._removeWindow(session, window)));
            } catch (_error) {
                // The final managed checks below still make restoration fail safe.
            }
        }

        try {
            window.minimize();
            if (!window.minimized || !this._isManaged(window))
                this._removeWindow(session, window);
        } catch (_error) {
            this._removeWindow(session, window);
        }
    }

    _isManaged(window) {
        try {
            // Meta.Window#get_display() is Mutter's authoritative association
            // with this display. The unmanaged signal removes normal entries
            // promptly; these checks cover races during minimize/restore.
            if (!window || typeof window.get_display !== 'function' ||
                window.get_display() !== global.display ||
                window.get_window_type() !== Meta.WindowType.NORMAL) {
                return false;
            }

            if (typeof global.display.list_all_windows === 'function') {
                const windows = global.display.list_all_windows();
                if (Array.isArray(windows) && !windows.includes(window))
                    return false;
            }

            return true;
        } catch (_error) {
            return false;
        }
    }

    _removeWindow(session, window) {
        const entry = session.entries.get(window);
        if (!entry)
            return;

        for (const id of entry.signalIds) {
            try {
                window.disconnect(id);
            } catch (_error) {
                // The object may already have been finalized by Mutter.
            }
        }
        session.entries.delete(window);
    }

    _restore(workspace, session) {
        const ownedWindows = new Set(session.entries.keys());
        const focusBeforeRestore = global.display.focus_window;

        for (const {window} of session.entries.values()) {
            try {
                if (this._isManaged(window) && window.minimized)
                    window.unminimize();
            } catch (_error) {
                // A window can disappear between the managed and minimized
                // checks; it must simply be omitted from restoration.
            }
        }

        this._disconnectSession(session);
        this._sessions.delete(workspace);

        const previous = session.previouslyFocused;
        const deliberateFocus = focusBeforeRestore &&
            !ownedWindows.has(focusBeforeRestore);
        if (!deliberateFocus && this._isRestorable(previous)) {
            try {
                previous.activate(global.get_current_time());
            } catch (_error) {
                // Focus restoration is best effort and never affects windows.
            }
        }
    }

    _isRestorable(window) {
        try {
            const workspace = global.workspace_manager.get_active_workspace();
            const locatedOnWorkspace = typeof window?.located_on_workspace === 'function'
                ? window.located_on_workspace(workspace)
                : typeof window?.get_workspace === 'function' &&
                    window.get_workspace() === workspace;
            return this._isManaged(window) && !window.minimized && locatedOnWorkspace;
        } catch (_error) {
            return false;
        }
    }

    _disconnectSession(session) {
        if (session.workspaceSignalId) {
            try {
                session.workspace.disconnect(session.workspaceSignalId);
            } catch (_error) {
                // The workspace may have been removed during teardown.
            }
            session.workspaceSignalId = 0;
        }

        for (const entry of session.entries.values()) {
            for (const id of entry.signalIds) {
                try {
                    entry.window.disconnect(id);
                } catch (_error) {
                    // Safe teardown for an already unmanaged window.
                }
            }
        }
        session.entries.clear();
    }

    destroy() {
        // Do not restore here: disabling must not change the user's windows.
        for (const session of this._sessions.values())
            this._disconnectSession(session);
        this._sessions.clear();
    }
}
