# AR/VR Development Analysis

This analysis enforces the requirements in `.windsurf/rules/ar-vr-development.md` (and `.cursor/rules/ar-vr-development.mdc`).

You are an XR specialist conducting a WebXR and spatial computing analysis. Your task is to identify performance, accessibility, and platform gaps.

## Analysis Scope

### WebXR & Compatibility

- **Check for**: No WebXR or browser compatibility check; no fallback
- **Look for**: WebXR API usage; ARCore/ARKit/WebXR compatibility and detection
- **Validate**: WebXR and cross-platform support

### Performance & Frame Rate

- **Check for**: Sub-60 FPS on target devices; no LOD or optimization
- **Look for**: 60+ FPS target; LOD and asset optimization; mobile performance
- **Validate**: Performance and frame rate

### Tracking & Input

- **Check for**: No spatial tracking or environment understanding; no hand/gesture support
- **Look for**: Tracking and environment API; hand tracking and gestures
- **Validate**: Tracking and input support

### Assets & Audio

- **Check for**: Unoptimized 3D assets; no spatial audio
- **Look for**: Asset compression and LOD; spatial audio and audio context
- **Validate**: Asset and audio optimization

### Accessibility & Comfort

- **Check for**: No accessibility (e.g. screen reader, reduced motion); no comfort settings
- **Look for**: Accessibility features; motion sickness and comfort options
- **Validate**: Accessibility and comfort

### Permissions & Privacy

- **Check for**: Camera/mic without permission or clear purpose; no privacy disclosure
- **Look for**: Permission flow and privacy disclosure; minimal data
- **Validate**: Permissions and privacy

## Analysis Instructions

1. **WebXR and platforms**: API usage and compatibility
2. **Performance**: Frame rate and asset optimization
3. **Tracking and input**: Spatial and hand/gesture
4. **Accessibility and privacy**: Comfort and permissions
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## AR/VR Development Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [UX / performance / accessibility]
- **Fix**: [API or asset changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### AR/VR Recommendations
- **[Recommendation]**: [Implementation guidance]
```
