.PHONY: validate package clean

UUID := swipe-down-gesture@NoXei
PACKAGE := $(UUID).shell-extension.zip

validate:
	sh ./validate.sh

package: validate
	gnome-extensions pack --force --out-dir=. \
		--extra-source=gesture-adapter.js \
		--extra-source=window-manager.js \
		--extra-source=LICENSE \
		--schema=schemas/org.gnome.shell.extensions.swipe-down-gesture.gschema.xml \
		.

clean:
	rm -f $(PACKAGE) schemas/gschemas.compiled
