import { classRegistry } from '../ClassRegistry';
import { NONE } from '../constants';
import type {
  CanvasEvents,
  DragEventData,
  ObjectEvents,
  TEventsExtraData,
  TPointerEvent,
  TPointerEventNames,
  Transform,
} from '../EventTypeDefs';
import { Point } from '../Point';
import type { ActiveSelection } from '../shapes/ActiveSelection';
import type { Group } from '../shapes/Group';
import type { IText } from '../shapes/IText/IText';
import type { FabricObject } from '../shapes/Object/FabricObject';
import { type TToCanvasElementOptions } from '../typedefs';
import { isTouchEvent, stopEvent } from '../util/dom_event';
import { getDocumentFromElement, getWindowFromElement } from '../util/dom_misc';
import { sendPointToPlane } from '../util/misc/planeChange';
import { isActiveSelection } from '../util/typeAssertions';
import type { CanvasOptions, TCanvasOptions } from './CanvasOptions';
import { SelectableCanvas } from './SelectableCanvas';
import { TextEditingManager } from './TextEditingManager';

const addEventOptions = { passive: false } as EventListenerOptions;

const getEventPoints = (canvas: Canvas, e: TPointerEvent) => {
  const viewportPoint = canvas.getViewportPoint(e);
  const scenePoint = canvas.getScenePoint(e);
  return {
    viewportPoint,
    scenePoint,
  };
};

const addListener = (
  el: HTMLElement | Document,
  ...args: Parameters<HTMLElement['addEventListener']>
) => el.addEventListener(...args);
const removeListener = (
  el: HTMLElement | Document,
  ...args: Parameters<HTMLElement['removeEventListener']>
) => el.removeEventListener(...args);

const syntheticEventConfig = {
  mouse: {
    in: 'over',
    out: 'out',
    targetIn: 'mouseover',
    targetOut: 'mouseout',
    canvasIn: 'mouse:over',
    canvasOut: 'mouse:out',
  },
  drag: {
    in: 'enter',
    out: 'leave',
    targetIn: 'dragenter',
    targetOut: 'dragleave',
    canvasIn: 'drag:enter',
    canvasOut: 'drag:leave',
  },
} as const;

type TSyntheticEventContext = {
  mouse: { e: TPointerEvent };
  drag: DragEventData;
};

/**
 * Canvas class handles all event handling and rendering
 * Main responsibilities:
 * - Mouse/Touch events (down, move, up, wheel)
 * - Object selection and transformation
 * - Text editing
 * - Drag & drop
 */
export class Canvas extends SelectableCanvas implements CanvasOptions {
  /**
   * Contains the id of the touch event that owns the fabric transform
   * @type Number
   * @private
   */
  declare mainTouchId?: number;

  declare enablePointerEvents: boolean;

  /**
   * Holds a reference to a setTimeout timer for event synchronization
   * @type number
   * @private
   */
  declare private _willAddMouseDown: number;

  /**
   * Holds a reference to an object on the canvas that is receiving the drag over event.
   * @type FabricObject
   * @private
   */
  declare private _draggedoverTarget?: FabricObject;

  /**
   * Holds a reference to an object on the canvas from where the drag operation started
   * @type FabricObject
   * @private
   */
  declare private _dragSource?: FabricObject;

  /**
   * Holds a reference to an object on the canvas that is the current drop target
   * May differ from {@link _draggedoverTarget}
   * @type FabricObject
   * @private
   */
  declare private _dropTarget: FabricObject<ObjectEvents> | undefined;

  /**
   * a boolean that keeps track of the click state during a cycle of mouse down/up.
   * If a mouse move occurs it becomes false.
   * Is true by default, turns false on mouse move.
   * Used to determine if a mouseUp is a click
   */
  private _isClick: boolean;

  textEditingManager = new TextEditingManager(this);

  constructor(el?: string | HTMLCanvasElement, options: TCanvasOptions = {}) {
    super(el, options);
    // bind event handlers
    (
      [
        '_onMouseDown',
        '_onTouchStart',
        '_onMouseMove',
        '_onMouseUp',
        '_onTouchEnd',
        '_onResize',
        '_onMouseWheel',
        '_onMouseOut',
        '_onMouseEnter',
        '_onContextMenu',
        '_onClick',
        '_onDragStart',
        '_onDragEnd',
        '_onDragProgress',
        '_onDragOver',
        '_onDragEnter',
        '_onDragLeave',
        '_onDrop',
      ] as (keyof this)[]
    ).forEach((eventHandler) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      this[eventHandler] = (this[eventHandler] as Function).bind(this);
    });
    // register event handlers
    this.addOrRemove(addListener);
  }

  /**
   * return an event prefix pointer or mouse.
   * @private
   */
  private _getEventPrefix() {
    return this.enablePointerEvents ? 'pointer' : 'mouse';
  }

  /**
   * Add or remove event listeners from canvas
   * @private
   */
  addOrRemove(functor: any, forTouch = false) {
    const canvasElement = this.upperCanvasEl,
      eventTypePrefix = this._getEventPrefix();
    functor(getWindowFromElement(canvasElement), 'resize', this._onResize);
    functor(canvasElement, eventTypePrefix + 'down', this._onMouseDown);
    functor(
      canvasElement,
      `${eventTypePrefix}move`,
      this._onMouseMove,
      addEventOptions,
    );
    functor(canvasElement, `${eventTypePrefix}out`, this._onMouseOut);
    functor(canvasElement, `${eventTypePrefix}enter`, this._onMouseEnter);
    functor(canvasElement, 'wheel', this._onMouseWheel, { passive: false });
    functor(canvasElement, 'contextmenu', this._onContextMenu);
    if (!forTouch) {
      functor(canvasElement, 'click', this._onClick);
      functor(canvasElement, 'dblclick', this._onClick);
    }
    functor(canvasElement, 'dragstart', this._onDragStart);
    functor(canvasElement, 'dragend', this._onDragEnd);
    functor(canvasElement, 'dragover', this._onDragOver);
    functor(canvasElement, 'dragenter', this._onDragEnter);
    functor(canvasElement, 'dragleave', this._onDragLeave);
    functor(canvasElement, 'drop', this._onDrop);
    if (!this.enablePointerEvents) {
      functor(canvasElement, 'touchstart', this._onTouchStart, addEventOptions);
    }
  }

  /**
   * Removes all event listeners, used when disposing the instance
   */
  removeListeners() {
    this.addOrRemove(removeListener);
    const eventTypePrefix = this._getEventPrefix();
    const doc = getDocumentFromElement(this.upperCanvasEl);
    removeListener(
      doc,
      `${eventTypePrefix}up`,
      this._onMouseUp as EventListener,
    );
    removeListener(
      doc,
      'touchend',
      this._onTouchEnd as EventListener,
      addEventOptions,
    );
    removeListener(
      doc,
      `${eventTypePrefix}move`,
      this._onMouseMove as EventListener,
      addEventOptions,
    );
    removeListener(
      doc,
      'touchmove',
      this._onMouseMove as EventListener,
      addEventOptions,
    );
    clearTimeout(this._willAddMouseDown);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.removeListeners();
    this.textEditingManager.dispose();
    super.destroy();
  }
}