window.DEBUG=[];
// ---------------------------------------------------------------------------
// PaRenderer -- a class to render recorded tests to a CasperJS
// test format.
// ---------------------------------------------------------------------------
if (typeof(EventTypes) == "undefined") {
    EventTypes = {};
}

EventTypes.OpenUrl = 0;
EventTypes.Click = 1;
EventTypes.Change = 2;
EventTypes.Comment = 3;
EventTypes.Submit = 4;
EventTypes.CheckPageTitle = 5;
EventTypes.CheckPageLocation = 6;
EventTypes.CheckTextPresent = 7;
EventTypes.CheckValue = 8;
EventTypes.CheckValueContains = 9;
EventTypes.CheckText = 10;
EventTypes.CheckHref = 11;
EventTypes.CheckEnabled = 12;
EventTypes.CheckDisabled = 13;
EventTypes.CheckSelectValue = 14;
EventTypes.CheckSelectOptions = 15;
EventTypes.CheckImageSrc = 16;
EventTypes.PageLoad = 17;
EventTypes.ScreenShot = 18;
EventTypes.MouseDown = 19;
EventTypes.MouseUp = 20;
EventTypes.MouseDrag = 21;
EventTypes.MouseDrop = 22;
EventTypes.KeyPress = 23;

// constructor
function PaRenderer(document) {
    this.document = document;
    this.title = "Testcase";
    this.items = null;
    this.history = [];
    this.screen_id = 1;
}

// certain events should be clicked but others should be setting the value after a change
// otherwise text deletes are missed, select box values are missed etc
var clickEvents = [ 'radio', 'checkbox', 'submit', 'button' ];

PaRenderer.prototype.doClick = function ( type ) {
    return (clickEvents.indexOf( type ) > 0);
};

PaRenderer.prototype.pyrepr = function(text, escape) {
    // There should a more eloquent way of doing this but by  doing the escaping before adding the string quotes prevents the string quotes from accidentally getting escaped creating a syntax error in the output code.
    var s = text;
    if (escape) s = s.replace(/(['"])/g, "\\$1");
    s = "'" + s + "'";
    return s;
};

PaRenderer.prototype.space = function() {
    //this.document.write("\n");
    document.getElementById('textcode').value=document.getElementById('textcode').value + "\n";
};


PaRenderer.prototype.text = function(txt) {
    document.getElementById('textcode').value=document.getElementById('textcode').value + txt;
};

PaRenderer.prototype.stmt = function(text, indent) {
    if(indent==undefined) indent = 1;
    var output = (new Array(4*indent)).join(" ") + text;
    //this.document.writeln(output);
    document.getElementById('textcode').value=document.getElementById('textcode').value + output;
};

PaRenderer.prototype.cont = function(text) {
    //this.document.writeln("    ... " + text);
    document.getElementById('textcode').value=document.getElementById('textcode').value + text;
};

PaRenderer.prototype.pyout = function(text) {
    //this.document.writeln("    " + text);
    document.getElementById('textcode').value=document.getElementById('textcode').value + text;
};

// escape special characters to make them string safe
PaRenderer.prototype.regexp_escape = function(text) {
    // removed \s as partially matched \n etc not sure why that was there at all.
    return text.replace(/[-[\]{}()*+?.,\\^$|#\/]/g, "\\$&");
};
// escape line feed and tab
PaRenderer.prototype.escapeSpecial = function(text) {
    var out = text.replace(/\n/g, "\\n");
    out = out.replace(/\r/g, "\\r");
    out = out.replace(/\t/g, "\\t");
    return out;
};
PaRenderer.prototype.escapeBackslash = function(text) {
    return text.replace("\\", "\\\\\\");
};

// returns locator querySelector for itemstring
PaRenderer.prototype.getLocatorString = function ( item ) {
    var selector;
//    console.log ('CALLED',item);
    if ( item && item.info && item.info.selector ) {
        selector = this.escapeBackslash( item.info.selector );
        return 'document.querySelector( "' + selector + '" )';

    } else {
        throw new Error( 'item for locatorString not found', item )
    }
};
// gets the value for an item and fully escapes to make it safe for exec statement
PaRenderer.prototype.getEscapedText = function ( item ) {
    var out = this.regexp_escape( item.text );
    console.log('out',out);
    return this.escapeSpecial( out );
};

PaRenderer.prototype.cleanStringForXpath = function(str, escape)  {
    var parts  = str.match(/[^'"]+|['"]/g);
    parts = parts.map(function(part){
        if (part === "'")  {
            return '"\'"'; // output "'"
        }

        if (part === '"') {
            return "'\"'"; // output '"'
        }
        return "'" + part + "'";
    });
    var xpath = '';
    if(parts.length>1) {
        xpath = "concat(" + parts.join(",") + ")";
    } else {
        xpath = parts[0];
    }
    if(escape) xpath = xpath.replace(/(["])/g, "\\$1");
    return xpath;
};

var d = {};
d[EventTypes.OpenUrl] = "openUrl";
d[EventTypes.Click] = "click";
d[EventTypes.Change] = "change";
d[EventTypes.Comment] = "comment";
d[EventTypes.Submit] = "submit";
d[EventTypes.CheckPageTitle] = "checkPageTitle";
d[EventTypes.CheckPageLocation] = "checkPageLocation";
d[EventTypes.CheckTextPresent] = "checkTextPresent";
d[EventTypes.CheckValue] = "checkValue";
d[EventTypes.CheckText] = "checkText";
d[EventTypes.CheckHref] = "checkHref";
d[EventTypes.CheckEnabled] = "checkEnabled";
d[EventTypes.CheckDisabled] = "checkDisabled";
d[EventTypes.CheckSelectValue] = "checkSelectValue";
d[EventTypes.CheckSelectOptions] = "checkSelectOptions";
d[EventTypes.CheckImageSrc] = "checkImageSrc";
d[EventTypes.PageLoad] = "pageLoad";
d[EventTypes.ScreenShot] = "screenShot";
/*d[EventTypes.MouseDown] = "mousedown";
 d[EventTypes.MouseUp] = "mouseup"; */
d[EventTypes.MouseDrag] = "mousedrag";
d[EventTypes.KeyPress] = "keypress";

PaRenderer.prototype.dispatch = d;

PaRenderer.prototype.render = function(with_xy) {
    this.with_xy = with_xy;
    var etypes = EventTypes;
    this.document.open();

    this.writeHeader();
    var last_down = null;
    var forget_click = false;

    DEBUG.script = this;
    for (var i=0; i < this.items.length; i++) {
        var item = this.items[i];
        if (item.type == etypes.Comment)
            this.space();

        if(i==0) {
            this.startUrl(item);
            continue;
        }

        // remember last MouseDown to identify drag
        if(item.type==etypes.MouseDown) {
            last_down = this.items[i];
            continue;
        }
        if(item.type==etypes.MouseUp && last_down) {
            if(last_down.x == item.x && last_down.y == item.y) {
                forget_click = false;
                continue;
            } else {
                item.before = last_down;
                this[this.dispatch[etypes.MouseDrag]](item);
                last_down = null;
                forget_click = true;
                continue;
            }
        }
        if(item.type==etypes.Click && forget_click) {
            forget_click = false;
            continue;
        }

        // we do not want click due to user checking actions
        if(i>0 && item.type==etypes.Click &&
            ((this.items[i-1].type>=etypes.CheckPageTitle && this.items[i-1].type<=etypes.CheckImageSrc) || this.items[i-1].type==etypes.ScreenShot)) {
            continue;
        }

        if (this.dispatch[item.type]) {
            this[this.dispatch[item.type]](item);
        }
        if (item.type == etypes.Comment)
            this.space();
    }
    this.writeFooter();
    this.document.close();
};

PaRenderer.prototype.writeHeader = function() {
    this.document.write("PA Script:<br><textarea rows='60' cols='250' id='textcode'>");
};
PaRenderer.prototype.writeFooter = function() {
    this.document.write("</textarea>");
};
PaRenderer.prototype.startUrl = function(item) {
    var url = this.pyrepr( item.url );
    this.stmt("//navigate\t" + url,1);
    this.space();
};

PaRenderer.prototype.click = function(item) {
    var tag = item.info.tagName.toLowerCase(),
        type = (''+item.info.type).toLowerCase(),
        locator = this.getLocatorString( item ),
        _that = this,
        WAIT = true;
    // private functions to commont tasks
    function _exec ( wait) {
        var waitStr = wait ? 'AndWait' : '';
        _that.stmt( 'exec' + waitStr + '\t' + locator + '.click()', 0 );
        _that.space();
    }
    if(this.with_xy && !(tag == 'a' || tag == 'input' || tag == 'button')) {
        this.stmt('this.then(function() {');
        this.stmt('    this.mouse.click('+ item.x + ', '+ item.y +');');
        this.stmt('});');
    } else {
        if (tag == 'a') {
            var href = item.info.href;
            if (href.length && href.substr(0,1) !== "#") {
                _exec ( WAIT );
            } else {
                _exec ();
            }
        } else if (tag == 'input') {
            if (type === 'radio') {
//                this.stmt('exec\t'+ locator + '.checked = "true"',0);
                _exec();

            } else if (type === 'checkbox') {
//                this.stmt('exec\t' + locator + '.checked = !' + locator + '.checked',0);
                _exec();
            } else if (type === 'submit') {
                _exec ( WAIT );
                this.stmt('//assume that the button press will submit the form and load the next page (i.e. clickAndWait)',1);
                this.space();
            } else if (type === 'button') {
                _exec ();
                this.stmt('//assume that the button press will NOT submit load the next page (i.e. not clickAndWait)',1);
                this.space();
            } else {
                // just set focus for text variants eg text, tel, email, date
                //this.stmt('exec\t' + locator + '.focus()',0);
                //this.space();
                _exec ();
            }
        } else if (tag === 'button') {
            if (type === 'submit') {
                _exec ( WAIT );
                this.stmt('//assume that the button press will submit the form and load the next page (i.e. clickAndWait)',1);
                this.space();
            } else {
                _exec ();
                this.stmt('//assume that the button press will NOT submit load the next page (i.e. not clickAndWait)',1);
                this.space();
            }
        } else {
            _exec ();
            this.space();
        }
        console.log('click:' ,item.info.id,locator,tag,type,item );
    }
};
PaRenderer.prototype.change = function(item) {
    var tag = item.info.tagName.toLowerCase(),
        type = (''+item.info.type).toLowerCase(),
        locator = this.getLocatorString( item );
    console.log ('change input:',tag,type,item);
    if ( !this.doClick( type ) ) {
        this.stmt( 'exec\t' + locator + '.value="' + item.info.value + '"', 0 );
        this.space();
    }
};

// now just sets the value, may need to trigger digest loops for jquery forms etc
PaRenderer.prototype.keypress = function(item) {
    /*var text = item.text.replace('\n','').replace('\r', '\\r');
     this.space();

     this.stmt('this.sendKeys("' + this.getControl(item) + '", "' + text + '");',3);
     this.space();
     this.stmt('});',2);
     */
/* this is now handled by change event as delete was being lost etc
    var locator = this.getLocatorString( item );

    this.stmt('exec\t' + locator + '.value="' + this.getEscapedText( item ) + '"',0);
    this.space();
 */
};

// stub all methods for casper that are not defined and log if they get called
var casperMethods = ["text", "stmt", "cont", "pyout", "pyrepr", "space", "regexp_escape", "escapeBackslash", "cleanStringForXpath", "dispatch", "render", "writeHeader", "writeFooter", "rewriteUrl", "shortUrl", "startUrl", "openUrl", "pageLoad", "normalizeWhitespace", "getControl", "getControlXPath", "getLinkXPath", "mousedrag", "click", "getFormSelector", "keypress", "submit", "screenShot", "comment", "checkPageTitle", "checkPageLocation", "checkTextPresent", "checkValue", "checkText", "checkHref", "checkEnabled", "checkDisabled", "checkSelectValue", "checkSelectOptions", "checkImageSrc", "waitAndTestSelector", "postToCasperbox"],
    stubCurry = function ( method ) {
    // only log once
    var _called = false;
    return function () {
        if (! _called) {
            console.log( 'warning: PaRenderer.' + method + ' called', arguments );
            _called = true;
        }
    };
};


// used to get the casperMethods list    console.log ( Object.keys (PaRenderer.prototype) );
for ( var i=0; i<casperMethods.length; i++) {
    if ( !PaRenderer.prototype[  casperMethods[i] ] ) {
        PaRenderer.prototype[  casperMethods[i] ] = stubCurry( casperMethods[i]);
    }
}

// create instance and bootstrap to window.onLoad.
var dt = new PaRenderer(document);
window.onload = function onpageload() {
    var with_xy = false;
    if(window.location.search=="?xy=true") {
        with_xy = true;
    }
    chrome.runtime.sendMessage({action: "get_items"}, function(response) {
        try {
            dt.items = response.items;
            dt.render( with_xy );
        } catch (err) {
            console.trace (err);
            // ignore errors here
        }
    });
};
