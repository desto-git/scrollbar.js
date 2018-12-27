What is this?
-------------
A script which produces stylable scrollbars. It also allows styling of the resize handle.
[Check out the demo page](https://desto-git.github.io/scrollbar.js/demo/)



Aren't there a ton of those already?
------------------------------------
Yes, but they all had at least 1 of the following shortcomings:
- Dependent on a library or framework
- Only works vertically
- Native scroll behavior is lost (hello autoscrolling) or messily emulated (e.g. smooth scrolling isn't applied)
- Doesn't dynamically adjust when content changes
- Messes with the element (nesting content into a new div, applying css rules, ...)
- Requires setting height/width on the element to work
- Probably some other things I forgot before writing it down

However, I can't blame them. I couldn't come up with a solution that doesn't have any of these problems either. See the [Limitations](#limitations) and [What have I tried?](#what-have-i-tried) section below for more on that topic.



Browser support?
----------------
I've only tested it in Internet Explorer 11, Firefox 47 and Chrome 51. It probably works on older versions as well.



Goals
-----
I only want to style scrollbars, so...
- It should behave like the native one
- It shouldn't mess with existing elements



Limitations
-----------
- Since there is no way to figure out the distance the native scrollbar would scroll on click, the distance has to be guessed (see `tools/scrollDistance/`)
- The content of the target element will be placed inside another div. That's to retain native scrolling behavior with the mouse and keyboard. If you dynamically add content to it, check if the class `scrollbarjs` is present to add it to its first child instead.
- Doesn't work with textareas (yet?)
- Doesn't work with direction:rtl (yet?)
- `padding-right` doesn't properly work on containers that overflow horizontally. That's not a problem with this script though. This behavior already exists in natively overlflowing containers.
- While modifying the scrollbar of the body does work, I would suggest against doing so on mobile devices. The autohide behavior of the url bar will break. It would hide only after scrolling all the way to the bottom, and then a bit. Same on the way back up, which is really frustrating.



Installation
------------
Just include the script, call `scrollbarjs.init()` and add elements via `scrollbarjs.add( element )`.

```html
<!-- at the end of body -->
<script src="scrollbar.js"></script>
<script>
	scrollbarjs.init();
	var $elems = document.getElementsByClassName('custom-scrollbar');
	for( var i = 0; i < $elems.length; ++i ){
		scrollbarjs.add( $elems[i] );
	}
</script>
</body>
```

You might also want to link `src/scrollbar-basic.css` when starting out. This file contains some basic styling.

```html
<link rel="stylesheet" href="scrollbar-basic.css">
```

You can change some default values by passing an object to `scrollbarjs.init()`.
- `prefix: string = "scrollbarjs"` the prefix to use for generated classes (don't forget to change the .css accordingly)
- `buttonDistance: number = 60` the distance to scroll when clicking on a scrollbar button.
	If this is an integer, it will scroll by that many pixels.
	If this is a floating point number, it will be used as a multiplicator (e.g. 0.90 scrolls by 90%). If you want to scroll by 100%, you have to specifiy something really close to it, like 0.9999. That's because JS can't actually differentiate between ints and floats.
- `trackDistance: number = 0.9` the distance to scroll when clicking on the track (the part between button and thumb).
	Values act the same as above.
- `delay: number = 200` the time in milliseconds to wait until the mousedown event repeats
- `repeat: number = 50` the time in milliseconds to wait between repeats

`scrollbarjs.init()` returns an object containing some information that you might want to make use of:
- `nativeHeight: number` height of the native scrollbar
- `nativeWidth: number` width of the native scrollbar
- `nativeDisplaces: boolean` does the native scrollbar displace the content? (usually desktop browsers do, mobile ones don't)
- `supportsWebkitStyling: boolean` are `::-webkit-scrollbar` pseudo classes supported? [WebKit Blog](https://webkit.org/blog/363/styling-scrollbars/)
- `supportsMsHiding: boolean` is `-ms-overflow-style` supported? [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/-ms-overflow-style)
- `supportsScrollbarWidth: boolean` is `scrollbar-width` supported? [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)
- `supportsNativeHiding: boolean` is any of the above supported? They all explicitly check for hiding the native scrollbar.

```javascript
var scrollbarProperties = scrollbarjs.init({
	prefix: 'sb',
	buttonDistance: 0.25
});
```



Note!
-----
- If you have padding on a target element, apply it to `target > .scrollbarjs-viewport` instead.
- On the body element, the body's height will be set to 100vh. Otherwise, it would gradually grow when it's smaller, or it won't scroll if it is bigger.


How does it work?
-----------------
First the script will figure out the native scrollbar width and height. It does so by creating an element with scrollbars and calculating `offsetWidth - clientWidth` and the same for height. This element will be removed afterwards.

`scrollbarjs.init()` will add some required CSS styling to the page, as well as adjust some variables, if a fitting object is passed as a paramater.

When adding an element (`$elem`) via `scrollbarjs.add($elem)`, its content will be copied to a newly created div (`$viewport`). `$elem`'s scrollbars will be hidden via the CSS rule `overflow:hidden;` while `$viewport` will have a negative margin to hide its native scrollbars. This way the mousewheel, arrow keys and other means of scrolling still work like normal. `$viewport` will be placed inside `$elem`, alongside the scrollbars.

Using `requestAnimationFrame()`, the script will check each frame if a scrollbar or the `$viewport` itself needs to be updated. Therefore the size and scroll position of the `$viewport` will be saved to its dataset. If it changes, the scrollbars will be updated.



What have I tried?
------------------
Just putting `overflow:hidden;`:
- Native scroll behavior is lost
- It's still possible to scroll via JavaScript, but that might feel off depending on the default browser scrolling

Put scrollbar on top of the native one:
- Maybe I want a narrow scrollbar? The native one won't be fully covered then
- Maybe I want a transparent scrollbar? The native one would shine through then

Place absolutely positioned div above the target area:
- Well, scrolling works, but selecting text is no longer possible
- Adding mousedown event listener to remove the "overlay" didn't work as hoped (text selection still was dodgy)
- Also having to deal with passing events to the actual element was too fiddly

Put the content into a nested div:
- This is the one I settled with, as it feels the most natural, at the expense of more work to integrate it into ones website
- Messes with the content, so if content is dynamically added, extra care must be taken
- Eventually conflicts with existing CSS rules

Wrap the entire element into a new div:
- a bunch of CSS rules need to be copied (margin, positon, display border, border-radius, outside box-shadow, width, max-width, ...) to the wrapper...
- ...and then be removed from the element to not make things look weird
- watching for CSS rule changes (via adding a class, using developer tools, ...) might be a CPU-intensive task compared to just checking the size and scroll position
