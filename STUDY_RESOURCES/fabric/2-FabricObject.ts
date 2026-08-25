import type { ObjectEvents } from '../../EventTypeDefs';
import { FabricObjectSVGExportMixin } from './FabricObjectSVGExportMixin';
import { InteractiveFabricObject } from './InteractiveObject';
import { applyMixins } from '../../util/applyMixins';
import type { FabricObjectProps } from './types/FabricObjectProps';
import type { TFabricObjectProps, SerializedObjectProps } from './types';
import { classRegistry } from '../../ClassRegistry';

/**
 * Base class for all 2D objects in Fabric.js
 * Represents a shape that can be rendered on the canvas
 * 
 * Responsibilities:
 * - Store position, size, rotation, scale data
 * - Render to canvas
 * - Fire events (selected, modified, etc)
 * - Serialize/deserialize
 */
export interface FabricObject<
  Props extends TFabricObjectProps = Partial<FabricObjectProps>,
  SProps extends SerializedObjectProps = SerializedObjectProps,
  EventSpec extends ObjectEvents = ObjectEvents,
> extends FabricObjectSVGExportMixin {}

export class FabricObject<
  Props extends TFabricObjectProps = Partial<FabricObjectProps>,
  SProps extends SerializedObjectProps = SerializedObjectProps,
  EventSpec extends ObjectEvents = ObjectEvents,
> extends InteractiveFabricObject<Props, SProps, EventSpec> {}

applyMixins(FabricObject, [FabricObjectSVGExportMixin]);

classRegistry.setClass(FabricObject);
classRegistry.setClass(FabricObject, 'object');

export { cacheProperties } from './defaultValues';