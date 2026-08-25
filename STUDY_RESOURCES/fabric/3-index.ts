export {
  getDevicePixelRatio,
  getEnv,
  getFabricDocument,
  getFabricWindow,
  setEnv,
  setEnvFactory,
} from './env';
export type * from './env';
export { cache } from './cache';
export { VERSION as version, iMatrix } from './constants';
export { config } from './config';
export { classRegistry } from './ClassRegistry';
export { runningAnimations } from './util/animation/AnimationRegistry';

export type * from './typedefs';

export type * from './EventTypeDefs';
export type { ITextEvents } from './shapes/IText/ITextBehavior';

export { Observable } from './Observable';

export type {
  TCanvasSizeOptions,
  TSVGExportOptions,
} from './canvas/StaticCanvas';
export type { StaticCanvasOptions } from './canvas/StaticCanvasOptions';
export { StaticCanvas } from './canvas/StaticCanvas';
export { Canvas } from './canvas/Canvas';
export type { CanvasOptions } from './canvas/CanvasOptions';
export { CanvasDOMManager } from './canvas/DOMManagers/CanvasDOMManager';
export { StaticCanvasDOMManager } from './canvas/DOMManagers/StaticCanvasDOMManager';

export type { XY } from './Point';
export { Point } from './Point';
export type { IntersectionType } from './Intersection';
export { Intersection } from './Intersection';
export { Color } from './color/Color';
export type * from './color/typedefs';

export * from './gradient';
export * from './Pattern';
export { Shadow } from './Shadow';
export type { SerializedShadowOptions } from './Shadow';

export { BaseBrush } from './brushes/BaseBrush';
export type * from './brushes/typedefs';

export { PencilBrush } from './brushes/PencilBrush';
export { CircleBrush } from './brushes/CircleBrush';
export { SprayBrush } from './brushes/SprayBrush';
export { PatternBrush } from './brushes/PatternBrush';
export { GLProbe } from './filters/GLProbes/GLProbe';
export { WebGLProbe } from './filters/GLProbes/WebGLProbe';

export type * from './util/path/typedefs';

export {
  FabricObject,
  FabricObject as Object,
} from './shapes/Object/FabricObject';

export {
  FabricObject as BaseFabricObject,
  type DrawContext,
} from './shapes/Object/Object';

export { InteractiveFabricObject } from './shapes/Object/InteractiveObject';

export type {
  TFabricObjectProps,
  FabricObjectProps,
  SerializedObjectProps,
} from './shapes/Object/types';
export type { SerializedLineProps } from './shapes/Line';
export { Line } from './shapes/Line';
export type { CircleProps, SerializedCircleProps } from './shapes/Circle';
export { Circle } from './shapes/Circle';
export { Triangle } from './shapes/Triangle';
export type { EllipseProps, SerializedEllipseProps } from './shapes/Ellipse';
export { Ellipse } from './shapes/Ellipse';
export type { RectProps, SerializedRectProps } from './shapes/Rect';
export { Rect } from './shapes/Rect';
export type { PathProps, SerializedPathProps } from './shapes/Path';
export { Path } from './shapes/Path';
export type { SerializedPolylineProps } from './shapes/Polyline';
export { Polyline } from './shapes/Polyline';
export { Polygon } from './shapes/Polygon';
export type {
  GraphemeBBox,
  SerializedTextProps,
  TPathAlign,
  TPathSide,
  TextProps,
} from './shapes/Text/Text';
export {
  FabricText,
  FabricText as Text,
} from './shapes/Text/Text';
export type {
  ITextProps,
  SerializedITextProps,
  CursorRenderingData,
  CursorBoundaries,
} from './shapes/IText/IText';
export { IText } from './shapes/IText/IText';
export type {
  GraphemeData,
  SerializedTextboxProps,
  TextboxProps,
} from './shapes/Textbox';
export { Textbox } from './shapes/Textbox';
export type {
  CompleteTextStyleDeclaration,
  TextStyleDeclaration,
  TextStyle,
} from './shapes/Text/StyledText';
export type {
  GroupEvents,
  GroupProps,
  GroupOwnProps,
  SerializedGroupProps,
} from './shapes/Group';
export { Group } from './shapes/Group';
export * from './LayoutManager';
export type { SerializedLayoutManager } from './LayoutManager';
export type {
  ActiveSelectionOptions,
  MultiSelectionStacking,
} from './shapes/ActiveSelection';
export { ActiveSelection } from './shapes/ActiveSelection';
export {
  FabricImage,
  FabricImage as Image,
} from './shapes/Image';
export type {
  ImageSource,
  SerializedImageProps,
  ImageProps,
} from './shapes/Image';
export { createCollectionMixin } from './Collection';

export * as util from './util';

export { loadSVGFromString } from './parser/loadSVGFromString';
export { loadSVGFromURL } from './parser/loadSVGFromURL';
export { parseSVGDocument } from './parser/parseSVGDocument';

export { Control } from './controls/Control';
export * as controlsUtils from './controls';
export type { ControlRenderingStyleOverride } from './controls';

export * from './filters';