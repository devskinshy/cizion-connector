interface Options {
  eventSymbolName?: string;
  key?: any;
  groupKey?: string;
}

interface BrowserOptions extends Options {
  parent?: boolean;
  children?: boolean;
}

type OptionsList = { browser: BrowserOptions };

interface NotificationParams {
  eventName: string;
  key?: Options["key"];
  groupKey?: Options["groupKey"];
  data?: any;
}

interface SubscribeParams {
  eventName: string;
  handler: EventListenerOrEventListenerObject | null;
}

interface EventItem {
  node: Node;
  handler: EventListenerOrEventListenerObject | null;
  capture: EventListenerOptions | boolean;
}

interface EventHandlers {
  [eventName: string]: Array<EventItem>;
}

class DefaultConnector {
  key: any;
  groupKey: any;
  eventSymbolName: string;
  _eventHandlers: EventHandlers = {}; // somewhere global

  constructor({
    key = Symbol(),
    groupKey = "ryperEventGroup",
    eventSymbolName = "ryperEvent",
  }: Options) {
    this.key = key;
    this.groupKey = groupKey;
    this.eventSymbolName = eventSymbolName;
  }

  _addListener(
    node: Node,
    eventName: string,
    handler: EventListenerOrEventListenerObject | null,
    capture: EventListenerOptions | boolean = false
  ) {
    if (!(eventName in this._eventHandlers)) {
      this._eventHandlers[eventName] = [];
    }
    // here we track the events and their nodes (note that we cannot
    // use node as Object keys, as they'd get coerced into a string
    this._eventHandlers[eventName].push({
      node,
      handler,
      capture,
    });
    node.addEventListener(eventName, handler, capture);
  }

  _removeAllListeners(targetNode: Node, eventName: string) {
    // remove listeners from the matching nodes
    if (!(eventName in this._eventHandlers)) {
      this._eventHandlers[eventName] = [];
    }

    this._eventHandlers[eventName]
      .filter(({ node }) => node === targetNode)
      .forEach(({ node, handler, capture }) =>
        node.removeEventListener(eventName, handler, capture)
      );

    // update _eventHandlers global
    this._eventHandlers[eventName] = this._eventHandlers[eventName].filter(
      ({ node }) => node !== targetNode
    );
  }

  _dispatch(eventName: string, data?: any) {
    document.dispatchEvent(
      new CustomEvent(eventName, {
        detail: data,
      })
    );
  }

  _generateEventName(eventName: string) {
    return `${eventName}.${this.eventSymbolName}`;
  }

  init() {
    throw "must override init";
  }

  subscribe(params: SubscribeParams) {
    const { eventName, handler } = params;
    if (!eventName) {
      throw "not have eventName";
    }
    if (!handler) {
      throw "not have handler";
    }
    const newParams = {
      ...params,
      eventName: this._generateEventName(eventName),
    };
    this._subscribe(newParams);
  }

  _subscribe(params: SubscribeParams) {
    console.log(params);
    throw "must override init";
  }

  notification(params: NotificationParams) {
    const { eventName } = params;
    if (!eventName) {
      throw "not have eventName";
    }
    const newParams = {
      ...params,
      eventName: this._generateEventName(eventName),
    };
    this._notification(newParams);
  }

  _notification(params: NotificationParams) {
    console.log(params);
    throw "must override init";
  }
}

class BrowserConnector extends DefaultConnector {
  parent: boolean;
  children: boolean;
  constructor({
    parent = !!(self === top),
    children = !!!(self === top),
    ...params
  }: BrowserOptions) {
    super(params);

    this.parent = parent;
    this.children = children;
  }

  init() {
    window.addEventListener(
      "message",
      ({ data }: MessageEvent<NotificationParams>) => {
        const { eventName, groupKey } = data;

        if (!eventName) {
          return;
        }
        if (groupKey !== this.groupKey) {
          return;
        }

        this._broadCast(data);
      },
      false
    );
  }
  _broadCast(params: NotificationParams) {
    const { eventName, data } = params;

    this._dispatch(eventName, data);

    let list = document.getElementsByTagName("iframe");
    Array.prototype.forEach.call(list, (iframe) => {
      iframe.contentWindow.postMessage(params, "*");
    });
  }
  _subscribe({ eventName, handler }: SubscribeParams) {
    this._removeAllListeners(document, eventName);
    this._addListener(document, eventName, handler);
  }
  _notification(params: NotificationParams) {
    params.key = this.key;
    params.groupKey = this.groupKey;

    if (this.parent) {
      this._broadCast(params);
    } else {
      window.parent.postMessage(params, "*");
    }
  }
}

const Connector = (() => {
  let connectorList = {
    browser: BrowserConnector,
  };
  let connector: DefaultConnector;

  const _getInstance = () => {
    if (!connector) {
      throw "must call init";
    }
    return connector;
  };

  const subscribe = (params: SubscribeParams) => {
    _getInstance().subscribe(params);
  };

  const notification = (params: NotificationParams) => {
    _getInstance().notification(params);
  };

  const init = (
    type: keyof typeof connectorList,
    options: OptionsList[keyof typeof connectorList]
  ) => {
    if (!connectorList[type]) {
      throw "connector is not defined";
    }

    connector = new connectorList[type](options);
    connector.init();
  };

  return { init, subscribe, notification };
})();

export default Connector;