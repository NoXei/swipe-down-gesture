# Swipe Down Gesture for GNOME

A tiny gnome extension. swipe down with 3 fingers to hide the window you're on,
or use 4 fingers when you want everything gone. thats pretty much it.

## btw i need a job

made this because i wanted it and couldnt find it anywhere. if you're hiring
someone who likes building/fixing little linux things, hi 👋
[heres my github](https://github.com/NoXei)

## Gestures

- **Three-finger swipe down:** minimize the focused window.
- **Four-finger swipe down:** minimize every eligible visible window on the
  current workspace.
- **Swipe down on a clear desktop:** restore only the windows previously hidden
  by the extension, when restoration is enabled.
- **Three-finger swipe up:** retains GNOME's normal Overview behavior.

The extension uses Mutter's native `Meta.Window.minimize()` and
`Meta.Window.unminimize()` operations. It does not close applications, hide
window actors, or inject keyboard shortcuts.

## Compatibility

- GNOME Shell 50
- Wayland touchpad gestures

## Installation

Build and install the extension:

```sh
make package
gnome-extensions install --force swipe-down-gesture@NoXei.shell-extension.zip
gnome-extensions enable swipe-down-gesture@NoXei
```

Log out and back in after the first installation. GNOME Shell caches extension
JavaScript, so a fresh Shell session is also required to test runtime source
changes reliably on Wayland.

## Preferences

Open the settings window with:

```sh
gnome-extensions prefs swipe-down-gesture@NoXei
```

Available settings:

- Enable or disable gesture handling.
- Enable or disable restoring hidden windows from a clear desktop.

## Window behavior

Only normal, visible, minimizable application windows on the active workspace
are affected. The extension skips windows that are already minimized, transient
dialogs, desktop components, and windows marked to be omitted from the task
list.

Restore state is tracked independently per workspace. A window is restored only
if the extension previously minimized it and Mutter still manages it. Disabling
the extension clears its internal restore state without changing any windows.

## Development

Validate JavaScript, metadata, and the settings schema:

```sh
make validate
```

Create the installable archive:

```sh
make package
```

## License

MIT
