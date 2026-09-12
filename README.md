# Swipe Down Gesture for GNOME

A small GNOME Shell extension that minimizes the visible application windows
on the current workspace with a three-finger swipe down. Swipe down again on a
clear desktop to restore only the windows hidden by the extension.

The extension uses Mutter's native window minimize/unminimize operations. It
does not close applications, fake a desktop, or inject keyboard shortcuts.

## Compatibility

- GNOME Shell 50
- Wayland touchpad gestures

## Install from source

```sh
make package
gnome-extensions install --force swipe-down-gesture@taha.shell-extension.zip
```

Log out and back in after the first installation, then enable the extension:

```sh
gnome-extensions enable swipe-down-gesture@taha
```

GNOME Shell caches extension JavaScript. After changing runtime code, log out
and back in to test a clean build on Wayland. Preferences run in a separate
process and only need to be closed and reopened.

## Validate

```sh
make validate
```

## Idea

Create a small GNOME Shell extension that adds a **three-finger swipe down** on
the normal desktop. The gesture hides every eligible window on the current
workspace in the same spirit as opening `Alt+Space` and choosing **Hide** on
each window.

The applications must remain open and keep running. This is a window-management
action, not an application close, quit, suspend, or kill operation.

## Desired Behavior

1. On the normal desktop, swipe down with three fingers.
2. All normal, visible windows on the current workspace are minimized.
3. The operation uses GNOME's own window-management animation and focus rules.
4. Swipe down again to restore the windows hidden by the extension.
5. A three-finger swipe up keeps its normal GNOME behavior and opens Overview.
6. The gesture does nothing while Overview or the application grid is active.

The default scope should be the current workspace, matching GNOME's usual
show-desktop behavior. An optional setting may extend the action to every
workspace.

## Native-Looking Design

The extension should behave like a missing GNOME window-manager action, not like
an overlay pretending to be a desktop feature.

- Call the real `Meta.Window.minimize()` operation instead of hiding actors with
  opacity, scale, translation, or CSS.
- Call `Meta.Window.unminimize()` when restoring windows.
- Let Mutter and GNOME Shell provide the normal minimize and restore animation.
- Do not create a fake desktop, full-screen cover, panel icon, notification, or
  custom window thumbnails.
- Do not send synthetic `Alt+Space`, `H`, `Super+D`, or other key events.
- Do not close applications or alter their documents and unsaved state.
- Respect GNOME's reduced-motion preference.

If a GNOME release requires an internal Shell API to preserve the exact native
animation, keep that code in a small version-specific adapter. The default
implementation should prefer stable window APIs and fail safely when an API is
not available.

## Window Selection

At the beginning of a hide operation, take a snapshot of the eligible windows.
Only windows in that snapshot may be restored by the extension.

Include:

- Normal application windows on the selected workspace.
- Visible windows that are not already minimized.

Skip:

- Windows that were already minimized before the gesture.
- Desktop, dock, panel, and other non-normal window types.
- Transient system surfaces and windows marked to skip the task list.
- Windows that are no longer managed by GNOME when restoration starts.

This ownership rule is important. If the user manually minimizes a different
window while the desktop is hidden, the extension must not restore that window
accidentally.

## Restore State

Maintain one restore session per workspace:

```text
RestoreSession
  workspace
  hiddenWindows
  previouslyFocusedWindow
  startedAt
```

For each hidden window, keep its `Meta.Window` reference while it is valid and
remove it when the window is unmanaged or destroyed. Before restoring, check
that the window is still managed and minimized.

When restoration completes, reactivate the previously focused window if it is
still available. Do not steal focus from a window the user deliberately chose
after the hide gesture unless that window belongs to the restore session.

## Gesture Handling

The first target is GNOME on Wayland using GNOME Shell's native touchpad gesture
events. The extension should observe the existing three-finger swipe stream and
capture only a downward swipe that starts on the normal desktop.

Gesture rules:

- Require exactly three fingers.
- Require a clear downward direction and a configurable distance threshold.
- Trigger once, after the gesture crosses the threshold or is released.
- Cancel a partial swipe without changing window state.
- Avoid interfering with GNOME's three-finger swipe up gesture.
- Avoid low-level background daemons and synthetic key injection.

X11 support can be a separate adapter. It should not compromise the Wayland
implementation or make the extension claim compatibility without being tested.

## Suggested Settings

Keep the preferences small and understandable:

- Enable or disable three-finger swipe down.
- Gesture direction and distance threshold.
- Restore with a second downward swipe.
- Scope: current workspace or all workspaces.
- Optional keyboard shortcut for hide and restore.
- Optional reduced-motion override, disabled by default.

There should be no required panel indicator. The gesture itself is the primary
interface. A shortcut is useful as a fallback and for accessibility testing.

## Extension Structure

```text
native-hide-all/
  extension.js          # GNOME Shell lifecycle and orchestration
  gesture-adapter.js    # Native touchpad event handling
  window-manager.js     # Selection, minimize, restore, and focus logic
  prefs.js              # Preferences window
  schemas/              # GSettings schema
  metadata.json         # Shell version and session compatibility
```

The `enable()` method should install gesture and window lifecycle listeners.
The `disable()` method must remove every listener and destroy every object it
created. Disabling the extension must not unexpectedly unminimize or close user
windows.

## Acceptance Criteria

- Three-finger swipe down hides all eligible visible windows on the current
  workspace.
- The visual result is indistinguishable from repeatedly using GNOME's native
  Hide/Minimize action, apart from being performed as one operation.
- Applications remain running and can be restored normally.
- A second gesture restores only the windows hidden by this extension.
- Windows already minimized before the gesture stay minimized.
- Closing a hidden application does not produce an error during restoration.
- Three-finger swipe up still opens GNOME Overview.
- Partial or accidental swipes do not change window state.
- Multiple workspaces and multiple monitors do not mix restore sessions.
- Disabling the extension leaves GNOME in a clean, predictable state.

## Important Distinction

`Alt+Space` followed by **Hide** normally acts on the focused window. The
extension should reproduce that operation for a set of windows by invoking
GNOME's window minimize behavior directly. It should not emulate the menu with
keyboard events, and it should not confuse hiding windows with quitting apps.

## Name Ideas

- Native Hide Desktop
- Three-Finger Show Desktop
- Hide All Windows
- Quiet Desktop
