# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

### Added

- Initial public release of the OpenGlass material and React components.
- `OpenGlassMaterial` type, `OPEN_GLASS_DEFAULTS`, and `OPEN_GLASS_PARAMS`.
- `makeOpenGlassDisplacementMap()` — R/G displacement map as a data URL.
- `makeOpenGlassShapeMap()` — displacement map from an arbitrary silhouette.
- `openGlassOverlayStyle()` — unfiltered rim + specular overlay.
- `openGlassRadius()` and `isWebKitEngine()` helpers.
- `<OpenGlassFilter>` React SVG filter component (with chromatic aberration).
- `<OpenGlass>` drop-in lens that owns the host layout, refract-a-copy path, and WebKit filter rebuild.
- `<OpenGlassToggle>` and `<OpenGlassSlider>` — accessible glass controls built on `<OpenGlass>`.
- `<GlassControlLens>` and `<GlassDiv>` — lower-level building blocks for custom interactive controls.
- `motion` utilities (`glassValue`, `animateGlassValue`, `useLensWobble`, etc.) for 60fps control animation.
- ESM + CJS builds with bundled type declarations.

[Unreleased]: https://github.com/naturaldesignapp/openglass/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/naturaldesignapp/openglass/releases/tag/v0.1.0
