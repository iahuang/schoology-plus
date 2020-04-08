"use strict";

/* HTMLess - a lightweight Javascript library for writing UI elements in JS */

class HLElement {
    constructor(tagName, children = []) {
        this.classes = [];
        this.attrs = {};
        this.children = [];
        this.tagName = tagName;
        this.children = children;

        this.eventListeners = [];
    }

    setAttr(attr, val = true) {
        this.attrs[attr] = val;
        return this;
    }

    onEvent(event, cb, capture) {
        this.eventListeners.push({
            type: event,
            callback: cb,
            capture: capture
        });
        return this;
    }

    // Global attribute wrappers

    id(id) {
        return this.setAttr("id", id);
    }
    contentEditable(i = true) {
        return this.setAttr("contenteditable", i);
    }
    draggable(i = true) {
        return this.setAttr("draggable", i);
    }
    spellcheck(i) {
        return this.setAttr("spellcheck", i);
    }
    style(i) {
        return this.setAttr("style", i);
    }

    class(className) {
        if (className) {
            this.classes.push(className);
        }
        return this;
    }

    // Text formatting syntactic sugar

    italicized() {
        return new HLElement("em", [this]);
    }
    strikethrough() {
        return new HLElement("s", [this]);
    }
    bold() {
        return new HLElement("strong", [this]);
    }
    superscripted() {
        return new HLElement("sup", [this]);
    }
    subscripted() {
        return new HLElement("sub", [this]);
    }

    // Event listener wrappers for common events

    onClick(cb) {
        this.onEvent("click", cb);
        return this;
    }

    // Represent this HLElement as an HTML Element
    render() {
        let htmlElement = document.createElement(this.tagName);

        // Set element class(es)
        if (this.classes.length > 0) {
            htmlElement.classList.add(...this.classes);
        }

        // Set HTML attributes
        for (let [attr, e] of Object.entries(this.attrs)) {
            htmlElement.setAttribute(attr, e);
        }

        // Build content
        for (let child of this.children) {
            let childNode = htmless.valueToNode(child);
            htmlElement.appendChild(childNode);
        }

        // Add event listeners
        for (let listener of this.eventListeners) {
            htmlElement.addEventListener(
                listener.type,
                listener.callback,
                listener.capture
            );
        }

        return htmlElement;
    }
}

class InlineHTMLElement {
    // Represents HTML code as a string literal
    constructor(content) {
        this.content = content;
    }
    render() {
        var tpl = document.createElement("template");
        tpl.innerHTML = this.content;
        return tpl.content;
    }
}

class HTMLess {
    constructor() {
        // A component-DOM lookup table
        // key: Component instance
        // value: array of DOM elements that correspond to each rendered instance of the component
        this.trackedElements = new Map();

        this.inlineComponents = {};
        this.inlineComponentLabels = {};
    }
    renderComponent(component) {
        let rendered = this.valueToNode(component.body());

        if (rendered instanceof DocumentFragment) {
            throw new Error(
                "For simplicity, component bodies cannot be document fragments (a node representing multiple elements). Try encapsulating it inside a div"
            );
        }

        this.trackedElements.set(rendered, component);

        return rendered;
    }

    inlineComponent(f, id) {
        let comp = new InlineComponent(id);
        comp.body = f;

        this.inlineComponents[id] = comp;
        return comp;
    }

    getInlineComponent(id) {
        let component = this.inlineComponents[id];
        if (component === undefined) {
            throw new Error("No inline component with id '" + id + "' exists");
        }
        return component;
    }

    getInlineComponentsByLabel(label) {
        let componentIds = this.inlineComponentLabels[label];
        if (componentIds === undefined) {
            throw new Error("No such label '" + label + "' exists");
        }

        return componentIds.map(id=>this.getInlineComponent(id));
    }

    rerenderComponent(component) {
        let elementsToReplace = [];
        for (let [
            element,
            associatedComponent
        ] of this.trackedElements.entries()) {
            if (component === associatedComponent) {
                elementsToReplace.push(element);
            }
        }

        for (let element of elementsToReplace) {
            this.trackedElements.delete(element); // remove
            let rendered = component.body().render();
            element.replaceWith(rendered);
            this.trackedElements.set(rendered, component);
        }

        // garbage collection

        for (let element of this.trackedElements.keys()) {
            if (!document.contains(element)) {
                this.trackedElements.delete(element);
            }
        }
    }

    rerenderInlineComponent(id) {
        this.rerenderComponent(this.getInlineComponent(id));
    }

    rerender(x) {
        if (x instanceof Component) {
            this.rerenderComponent(x);
        } else {
            this.rerenderInlineComponent(x);
        }
    }

    rerenderLabel(label) {
        let components = this.getInlineComponentsByLabel(label);
        for (let c of components) {
            this.rerender(c);
        }
    }

    valueToNode(value) {
        // Take a value of an arbitrary type and represent it as an HTML element
        if (typeof value !== "object") {
            return document.createTextNode(value);
        }
        if (value instanceof Component) {
            let rendered = htmless.renderComponent(value);
            return rendered;
        }
        if (value instanceof Array) {
            let frag = document.createDocumentFragment();
            for (let n of value) {
                frag.appendChild(this.valueToNode(n));
            }
            return frag;
        }
        if (value.render) {
            return value.render();
        }
        throw new Error("Invalid child type");
    }

    labelComponent(c, label) {
        if (c instanceof InlineComponent) {
            if (this.inlineComponentLabels[label]) {
                this.inlineComponentLabels[label].push(c.id);
            } else {
                this.inlineComponentLabels[label] = [c.id];
            }
        } else {
            throw new Error("Cannot label non-inline component");
        }
    }
}

function elementWithAttrSetters(...attrNames) {
    // Returns a subclass of HLElement with boilerplate methods added for setting attributes

    let target = class extends HLElement {};

    for (let attr of attrNames) {
        target.prototype[attr] = function(value) {
            this.attrs[attr] = value;
            return this;
        };
    }
    return target;
}

function elementFunction(tagName, T = HLElement) {
    return (...children) => {
        return new T(tagName, children);
    };
}

// Organization

let div = elementFunction("div");
let span = elementFunction("span");
let hr = new HLElement("hr");

// Text

let paragraph = elementFunction("p");
let hyperlink = elementFunction("a", elementWithAttrSetters("href"));
let headers = {
    h1: elementFunction("h1"),
    h2: elementFunction("h2"),
    h3: elementFunction("h3"),
    h4: elementFunction("h4"),
    h5: elementFunction("h5"),
    h6: elementFunction("h6")
};

let newline = new HLElement("br");

let smallText = elementFunction("small");
let superscript = elementFunction("sup");
let subscript = elementFunction("sub");

let codeBlock = elementFunction("code");

// Media

let image = function(src) {
    let subclass = elementWithAttrSetters(
        "alt",
        "crossorigin",
        "decoding",
        "height",
        "width",
        "loading"
    );
    return new subclass("img").setAttr("src", src);
};

class HLVideoElement extends HLElement {
    autoplay() {
        return this.setAttr("autoplay");
    }
    controls() {
        return this.setAttr("autoplay");
    }
    width(x) {
        return this.setAttr("width", x);
    }
    height(x) {
        return this.setAttr("height", x);
    }
    loop() {
        return this.setAttr("loop");
    }
    muted() {
        return this.setAttr("muted");
    }
    poster(p) {
        return this.setAttr("poster", p);
    }
    src(s) {
        return this.setAttr("src", s);
    }
}

let video = elementFunction("video", HLVideoElement);

// Form

let button = elementFunction("button");

class HLInputElement extends HLElement {
    constructor(type) {
        super("input", []);
        this.attrs["type"] = type;
    }
    disabled(d = true) {
        return this.setAttr("disabled", d);
    }
    readonly(d = true) {
        return this.setAttr("readonly", d);
    }
    placeholder(p) {
        return this.setAttr("placeholder", p);
    }
    autocomplete(a = true) {
        return this.setAttr("autocomplete", a);
    }
    name(n) {
        return this.setAttr("name", n);
    }
    initialValue(v) {
        return this.setAttr("value", v);
    }
}

// text fields

class HLTextField extends HLInputElement {
    constructor(type) {
        super(type);
    }
    maxlength(l) {
        return this.setAttr("maxlength", l);
    }
    minlength(l) {
        return this.setAttr("minlength", l);
    }
    min(x) {
        return this.setAttr("min", x);
    }
    max(x) {
        return this.setAttr("max", x);
    }
    pattern(p) {
        return this.setAttr("pattern", p);
    }
    multiple(x = true) {
        return this.setAttr("multiple", x);
    }
    size(x) {
        return this.setAttr("size", x);
    }
}

// date / time

class HLDateField extends HLInputElement {
    constructor() {
        super("checkbox");
    }
}

// other

class HLFileUpload extends HLInputElement {
    constructor() {
        super("file");
    }
    allowedFileTypes(types) {
        return this.setAttr("accept", types.join(","));
    }
    multiple(x = true) {
        return this.setAttr("multiple", x);
    }
    capture(x) {
        return this.setAttr("capture", x);
    }
}

let input = {
    // text fields
    text: () => {
        return new HLTextField("text");
    },
    numeric: () => {
        return new HLTextField("number");
    },
    email: () => {
        return new HLTextField("email");
    },
    password: () => {
        return new HLTextField("password");
    },
    search: () => {
        return new HLTextField("search");
    },
    phoneNumber: () => {
        return new HLTextField("tel");
    },
    url: () => {
        return new HLTextField("url");
    },
    // buttons
    checkbox: () => {
        return new HLInputElement("checkbox");
    },
    radio: () => {
        return new HLInputElement("radio");
    },
    // date/time
    date: () => {
        return new HLInputElement("date");
    },
    datetimeLocal: () => {
        return new HLInputElement("datetime-local");
    },
    month: () => {
        return new HLInputElement("month");
    },
    week: () => {
        return new HLInputElement("week");
    },
    // other
    file: () => {
        return new HLFileUpload();
    },
    color: () => {
        return new HLInputElement("color");
    }
};

// Misc

let inlineHTML = function(html) {
    return new InlineHTMLElement(html);
};

class Component {
    body() {
        throw new Error("No render method specified for this component");
    }
}

class InlineComponent extends Component {
    constructor(id) {
        super();
        this.id = id;
    }
    label(l) {
        htmless.labelComponent(this, l);
        return this;
    }
}

let htmless = new HTMLess();
