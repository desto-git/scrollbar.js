// int = px, float = %
// note however that 1.0 === 1, so it will be identified as an int. to say 100%, use something very close to it, e.g. 0.9999
type TDistance = number;

interface IConfig {
	prefix         ?: string;
	buttonDistance ?: TDistance;
	trackDistance  ?: TDistance;
	delay          ?: number;
	repeat         ?: number;
}

interface IScrollbarProperties {
	nativeHeight           : number;
	nativeWidth            : number;
	nativeDisplaces        : boolean;
	supportsWebkitStyling  : boolean;
	supportsMsHiding       : boolean;
	supportsScrollbarWidth : boolean;
	supportsNativeHiding   : boolean;
}

const scrollbarjs = (function(){

/*
	TODO:
	min-width/height on thumbs!!!
	refactor global variables
	textareas
	right to left text
	some way to reliably add padding-right the viewport
	look for a way to get padding-bottom work without the ::after workaround. It just might resolve the padding-right problem as well.
	- `smooth: (boolean) [=true]` should the emulated scrolling be smoothed?
	- `easing: (function) [=easeInOutQuad]` https://gist.github.com/gre/1650294
	probably more
*/

// don't forget to change your css accordingly
let configPrefix = 'scrollbarjs';

// distance to scroll when clicking
let configButtonDistance: TDistance = 60; // on a button
let configTrackDistance: TDistance = 0.9; // somewhere on the track

let configDelay = 200; // wait x milliseconds before repeating the action
let configRepeat = 50; // repeat every x milliseconds



// put some global things into local scope, so uglify can better compress the source
const doc = document;
const $head = doc.head as HTMLHeadElement;
const $body = doc.body;
const createElement = doc.createElement.bind( doc ) as ( tagName: string ) => HTMLElement;
const getCompStyle = getComputedStyle;

const appendChild = ( $parent: HTMLElement, $child: HTMLElement ) => {
	$parent.appendChild( $child );
}

const addEventListener = <K extends keyof HTMLElementEventMap>(
	$target: HTMLElement,
	event: K,
	callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
) => {
	$target.addEventListener( event, callback );
}

const addClass = ( $elem: Element, className: string ) => { $elem.classList.add   ( className ); }
const remClass = ( $elem: Element, className: string ) => { $elem.classList.remove( className ); }

// not-booleans are usually more readable in their positive form, but since this is only checked in the negative form it should be ok
const isNotLeftClick = ( event: MouseEvent ) => ( event.buttons & 1 ) !== 1; // this also works for mouseenter



// getPrefixed( 'viewport', 'fit-parent' ) => "configPrefix-viewport configPrefix-fit-parent"
const getPrefixed = ( ...args: string[] ) => {
	return args.map( arg => configPrefix + '-' + arg ).join(' ');
}



let wasInitialized = false;
const init = ( config?: IConfig ): IScrollbarProperties => {
	if( wasInitialized ) throw new Error('scrollbarjs cannot be initialized more than once');

	if( config !== undefined ){
		if( config.prefix         ) configPrefix         = config.prefix;
		if( config.buttonDistance ) configButtonDistance = config.buttonDistance;
		if( config.trackDistance  ) configTrackDistance  = config.trackDistance;
		if( config.delay          ) configDelay          = config.delay;
		if( config.repeat         ) configRepeat         = config.repeat;
	}

	// inject required CSS into the page
	const $style = createElement('style');
	$style.innerHTML =
		'body.' + configPrefix + '{' +
			'height:100vh;' + // min-height would gradually grow, max-height wouldn't show a scrollbar
		'}' +

		'.' + getPrefixed('drag') + '{' + // don't trigger selection when dragging the thumbs - https://stackoverflow.com/a/4407335
			'-webkit-touch-callout:none;' +
			  '-webkit-user-select:none;' +
			   '-khtml-user-select:none;' +
			     '-moz-user-select:none;' +
			      '-ms-user-select:none;' +
			          'user-select:none;' +
		'}' +

		'.' + configPrefix + '{' +
			'overflow:hidden;' +
			'position:relative;' +
		'}' +

		'.' + getPrefixed('viewport') + '{' +
			'overflow:scroll;' +
			'margin-right:'  + -nativeWidth  + 'px;' +
			'margin-bottom:' + -nativeHeight + 'px;' +
		'}' +

		'.' + getPrefixed('resizable') + '{' + // resizing is done in js
			'resize:none!important;' +
		'}';
	appendChild( $head, $style );

	wasInitialized = true;

	return {
		nativeHeight           : nativeHeight,
		nativeWidth            : nativeWidth,
		nativeDisplaces        : nativeHeight > 0 || nativeWidth > 0,
		supportsWebkitStyling  : supportsWebkitStyling,
		supportsMsHiding       : supportsMsOverflow,
		supportsScrollbarWidth : supportsScrollbarWidth,
		supportsNativeHiding   : supportsWebkitStyling || supportsMsOverflow || supportsScrollbarWidth,
	};
}



// below this point is calculated stuff

// to get the native width and height of a scrollbar, we create an element with overflow:scroll
// it will be removed right afterwards when we have the details we want
let nativeWidth  = 0;
let nativeHeight = 0;

// additionally, we check for some ways to hide the scrollbar natively (without killing scrolling like overflow:hidden does)
// in these cases, putting a wrapper around to hide the scrollbars would not be required
let supportsWebkitStyling  = false; // note that these don't seem to work on the body in mobile view
let supportsMsOverflow     = false;
let supportsScrollbarWidth = false;

(function(){ // scoping to pretent it didn't happen
	const id = 'scrollbarjs-sb-size';

	// add styles required for this to work
	const $style = createElement('style');
	appendChild( $head, $style );
	$style.innerHTML = '#' + id + '{' +
		'width:100%;'        + // it needs to be bigger than the scrollbar
		'height:100%;'       +
		'overflow:scroll;'   + // show scrollbars
		'position:absolute;' + // don't break the flow of the document in the process
		'top:100%;'          + // hide
	'}';

	// get dimensions of native scrollbars
	const $size = createElement('div');
	$size.id = id;
	appendChild( $body, $size );

	nativeWidth  = $size.offsetWidth  - $size.clientWidth;
	nativeHeight = $size.offsetHeight - $size.clientHeight;

	// check if native tricks are available to hide scrollbars
	$style.innerHTML +=
		'#' + id + '::-webkit-scrollbar{display:none}' + // webkit
		'#' + id + '{' +
			'-ms-overflow-style:none;' + // ie and edge
			'scrollbar-width:none;' + // firefox
		'}';

	try{
		supportsWebkitStyling = getCompStyle( $size, '::-webkit-scrollbar' ).display === 'none';
	}catch(e){
		// Firefox 56 throws when checking an unknown pseudo element (NS_ERROR_NOT_AVAILABLE)
	}

	const computedStyle = getCompStyle( $size );
	supportsMsOverflow = computedStyle.msOverflowStyle === 'none';
	// @ts-ignore property is still new
	supportsScrollbarWidth = computedStyle.scrollbarWidth === 'none';

	$style.parentElement.removeChild( $style );
	$size .parentElement.removeChild( $size  );
}());

const enum DragMode {
	none,
	scroll,
	resize,
}
let dragMode = DragMode.none;

enum Axis {
	none,
	ver,
	hor,
	both,
}
let dragAxis = Axis.none;

let $dragTarget: HTMLElement | null; // the content being scrolled

const reset = () => {
	clearInterval( IID );
	clearTimeout ( TID );
	dragMode = DragMode.none;
	remClass( $body, getPrefixed('drag') );
	if( $dragTarget ){
		remClass( $dragTarget.parentElement, getPrefixed('active') );
		$dragTarget = null;
	}
}
addEventListener( $body, 'mouseup', reset );
addEventListener( $body, 'mouseenter', e => {
	// leaving browser window and going back in, check if left mouse button is "still" pressed
	if( isNotLeftClick( e ) ) reset();
} );

let lastX = 0;
let lastY = 0; // last x y offset
let dragDistance = 0; // distance to scroll in pixels for each pixel the thumb has been moved
let viewportScrollPosition = 0; // the current x or y position as a double instead of an int, used to circumvent unprecise dragging
addEventListener( $body, 'mousemove', e => {
	if( dragMode === DragMode.scroll ){

		if( dragAxis === Axis.ver ){
			viewportScrollPosition += dragDistance * ( e.clientY - lastY );
			scrollViewport( $dragTarget, undefined, Math.round( viewportScrollPosition ), true );

		} else {
			viewportScrollPosition += dragDistance * ( e.clientX - lastX );
			scrollViewport( $dragTarget, Math.round( viewportScrollPosition ), undefined, true );
		}

	} else if( dragMode === DragMode.resize && dragAxis !== Axis.none ){
		// inconsistent behavior between browsers when resizing centered content
		// chrome's way makes more sense (resize by twice the amount when centered so it keeps following the cursor properly)
		// but firefox' is easier to implement, as I don't need to check for all the ways the content could be centered (margin: 0 auto, flexbox, text-align,..?)
		// and IE11 doesn't understand resize in the first place, so only benefits there!
		const x = ( e.clientX - lastX );
		const y = ( e.clientY - lastY );

		if( dragAxis !== Axis.hor  ){ // VER or BOTH
			const h = $dragTarget.clientHeight;
			$dragTarget.style.height = h + y + 'px';
			// verify if height is legit, e.g. in case max-height is set
			$dragTarget.style.height = getCompStyle( $dragTarget ).height;
		}

		if( dragAxis !== Axis.ver  ){ // HOR or BOTH
			const w = $dragTarget.clientWidth;
			$dragTarget.style.width = w + x + 'px';
			$dragTarget.style.width = getCompStyle( $dragTarget ).width;
		}
	}

	lastX = e.clientX;
	lastY = e.clientY;
} );



// event listeners
enum Direction {
	up,
	right,
	down,
	left,
}
const scrollInDirection = ( event: MouseEvent, $viewport: HTMLElement, direction: number, distance: number ) => {
	if( isNotLeftClick( event ) ) return;

	switch( direction ){
		case Direction.up    : scrollViewport( $viewport, 0, -distance    ); break;
		case Direction.right : scrollViewport( $viewport,     distance, 0 ); break;
		case Direction.down  : scrollViewport( $viewport, 0,  distance    ); break;
		case Direction.left  : scrollViewport( $viewport,    -distance, 0 ); break;
	}
}

const clickThumb = ( event: MouseEvent, $viewport: HTMLElement, direction: number ) => {
	if( isNotLeftClick( event ) ) return;

	addClass( $body, getPrefixed('drag') );
	addClass( $viewport.parentElement, getPrefixed('active') );

	const $target = (event.target as HTMLElement).parentElement;
	dragMode = DragMode.scroll;
	dragAxis = direction;
	$dragTarget = $viewport;

	if( direction === Axis.ver ){
		viewportScrollPosition = $viewport.scrollTop;
		dragDistance = $viewport.scrollHeight / $target.clientHeight;
	} else {
		viewportScrollPosition = $viewport.scrollLeft;
		dragDistance = $viewport.scrollWidth / $target.clientWidth;
	}
}

const clickResize = ( event: MouseEvent, $elem: HTMLElement, direction: number ) => {
	if( isNotLeftClick( event ) ) return;

	addClass( $body, getPrefixed('drag') );

	dragMode = DragMode.resize;
	dragAxis = direction;
	$dragTarget = $elem;
}

// helper functions
const CLASS_SCROLL_NONE = getPrefixed('scroll-none');
const CLASS_SCROLL_VER  = getPrefixed('scroll-ver' );
const CLASS_SCROLL_HOR  = getPrefixed('scroll-hor' );
const CLASS_SCROLL_BOTH = getPrefixed('scroll-both');
const switchScrollClass = ( $elem: HTMLElement, className: string ) => {
	if( $elem.classList.contains( className ) ) return;

	remClass( $elem, CLASS_SCROLL_NONE );
	remClass( $elem, CLASS_SCROLL_VER  );
	remClass( $elem, CLASS_SCROLL_HOR  );
	remClass( $elem, CLASS_SCROLL_BOTH );
	addClass( $elem, className );
}

let TID: number; // contains the timeout id so we can stop it
let IID: number; // interval id
const scrollViewport = ( $viewport: HTMLElement, x?: number, y?: number, jump?: boolean, repeat?: boolean ) => {
	if( jump ){
		if( x !== undefined ) $viewport.scrollLeft = x;
		if( y !== undefined ) $viewport.scrollTop  = y;

	} else {
		if( x % 1 === 0 ) $viewport.scrollLeft += x;                          // px
		else              $viewport.scrollLeft += $viewport.clientWidth  * x; // %
		if( y % 1 === 0 ) $viewport.scrollTop  += y;
		else              $viewport.scrollTop  += $viewport.clientHeight * y;
	}

	if( !repeat && !jump ){ // there's no need to repeat when jumping
		TID = setTimeout( () => {
			IID = setInterval( () => {
				scrollViewport( $viewport, x, y, jump, true );
			}, configRepeat );
		}, configDelay - configRepeat );
	}
}



// contains all the containers to watch over so we don't have to read the entire DOM every time update is called just to find our elements
const $ELEMS: HTMLElement[] = [];
const add = ( $elem: HTMLElement ) => {
	if( !wasInitialized ) throw new Error('scrollbarjs has not been initialized yet'); // this is to prevent weird behavior caused by missing CSS rules

	let viewportTagName: string;

	if( $elem.tagName === 'BODY' ){
		viewportTagName = 'div';

	} else if( $elem.tagName === 'TEXTAREA' ){
		// TODO: make textareas work
		viewportTagName = 'div';

	} else {
		viewportTagName = $elem.tagName;
	}

	const buildElement = ( class1: string, class2?: string, tagName: string = 'div' ) => {
		const $element = createElement(tagName);
		$element.className = getPrefixed(class1, class2);
		return $element;
	}

	const $viewport = buildElement('viewport', undefined, viewportTagName);
	$viewport.dataset.scrollbarjs = ' '; // a space so I don't have to do additional checks in the update function
	$viewport.innerHTML = $elem.innerHTML;

	$elem.innerHTML = '';
	appendChild( $elem, $viewport );

	// naming similar to https://webkit.org/blog/363/styling-scrollbars/
	const buildScrollbar = (axis: 'ver' | 'hor', dir1: 'up' | 'left', dir2: 'down' | 'right') => {
		const buildButton = ( direction: keyof typeof Direction ) => {
			const $button = buildElement('button', direction);
			addEventListener( $button, 'mousedown', e => scrollInDirection( e, $viewport, Direction[direction], configButtonDistance ) );

			return $button;
		}

		const buildTrack = ( direction: keyof typeof Direction ) => {
			const $track = buildElement('track-piece', 'track-' + direction);
			addEventListener( $track, 'mousedown', e => scrollInDirection( e, $viewport, Direction[direction], configTrackDistance ) );

			return $track;
		}

		const $trackAxis = buildElement('track', 'track-' + axis);
		const $thumbAxis = buildElement('thumb', 'thumb-' + axis);
		addEventListener( $thumbAxis, 'mousedown', e => clickThumb( e, $viewport, Axis[axis] ) );
		appendChild( $trackAxis, buildTrack( dir1 ) );
		appendChild( $trackAxis, $thumbAxis         );
		appendChild( $trackAxis, buildTrack( dir2 ) );

		const $axis = buildElement('scrollbar', axis, 'aside');
		appendChild( $axis, buildButton( dir1 ) );
		appendChild( $axis, $trackAxis          );
		appendChild( $axis, buildButton( dir2 ) );

		return $axis;
	}

	appendChild( $elem, buildScrollbar('ver', 'up'  , 'down' ) );
	appendChild( $elem, buildScrollbar('hor', 'left', 'right') );

	// corner
	const $corner = buildElement('corner');

	const resize = getCompStyle( $elem ).resize; // cannot be detected in Edge
	if( resize === 'both' || resize === 'horizontal' || resize === 'vertical' ){
		addClass( $elem, getPrefixed('resizable') );

		let axis: keyof typeof Axis;
		switch( resize ){
			case 'vertical':   axis = 'ver';  break;
			case 'horizontal': axis = 'hor';  break;
			case 'both':       axis = 'both'; break;
		}

		addClass( $corner, getPrefixed('resize-' + axis) );
		addEventListener( $corner, 'mousedown', e => clickResize( e, $elem, Axis[axis] ) );
	}

	appendChild( $elem, $corner );

	addClass( $elem, configPrefix );
	$ELEMS.push( $elem );
}



const updateViewport = ( $elem: HTMLElement, $viewport: HTMLElement ) => {
	// height:100% doesn't work on elements whose parents don't have an explicit value set
	// this is a hacky way to achieve this anyways
	// Firefox won't remember the scrollTop position after a reload, but I think that's bearable ;)
	if( $elem.clientHeight < $viewport.scrollHeight ){ // check if the element can grow

		const y = $viewport.scrollTop; // keep scrolling distance
		$viewport.style.height = ''; // try to be as big as the content

		if( $elem.clientHeight < $viewport.scrollHeight ) // if that doesn't work, shrink to fit
			$viewport.style.height = $elem.clientHeight + nativeHeight + 1 + 'px'; // +1 so the element will expand once it can, trying this procedure again
		else // if it did work, remove that spare 1px line at the bottom; this will prevent flickering when resizing
			$viewport.style.height = $elem.clientHeight + nativeHeight + 'px';

		$viewport.scrollTop = y;

	} else { // match the element
		$viewport.style.height = $elem.clientHeight + nativeHeight + 'px';
	}
}

const CLASS_BUTTON_INACTIVE = getPrefixed('button-inactive');
const updateScrollbars = ( $elem: HTMLElement, $viewport: HTMLElement ) => {
	// in % from 0 to 1, how much of the viewport is visible
	const visibleHeight = $viewport.clientHeight / $viewport.scrollHeight;
	const visibleWidth  = $viewport.clientWidth  / $viewport.scrollWidth;

	// which scrollbars are active
	     if( visibleHeight === 1 && visibleWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_NONE );
	else if( visibleHeight !== 1 && visibleWidth === 1 ) switchScrollClass( $elem, CLASS_SCROLL_VER  );
	else if( visibleHeight === 1 && visibleWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_HOR  );
	else if( visibleHeight !== 1 && visibleWidth !== 1 ) switchScrollClass( $elem, CLASS_SCROLL_BOTH );

	const getChild = ( $parent: HTMLElement, child: number, grandChild?: number ) => {
		let $child = $parent.children[ child ];
		if( grandChild !== undefined ) $child = $child.children[ grandChild ];
		return $child as HTMLElement;
	}

	// apply extra classes to indicate if a button will do something
	const $buttonUp    = getChild( $elem, 1, 0 );
	const $buttonDown  = getChild( $elem, 1, 2 );
	const $buttonLeft  = getChild( $elem, 2, 0 );
	const $buttonRight = getChild( $elem, 2, 2 );

	if( $viewport.scrollTop  === 0 ) addClass( $buttonUp,   CLASS_BUTTON_INACTIVE );
	else                             remClass( $buttonUp,   CLASS_BUTTON_INACTIVE );
	if( $viewport.scrollLeft === 0 ) addClass( $buttonLeft, CLASS_BUTTON_INACTIVE );
	else                             remClass( $buttonLeft, CLASS_BUTTON_INACTIVE );

	if( ( $viewport.scrollTop  + $viewport.clientHeight ) === $viewport.scrollHeight ) addClass( $buttonDown,  CLASS_BUTTON_INACTIVE );
	else                                                                               remClass( $buttonDown,  CLASS_BUTTON_INACTIVE );
	if( ( $viewport.scrollLeft + $viewport.clientWidth  ) === $viewport.scrollWidth  ) addClass( $buttonRight, CLASS_BUTTON_INACTIVE );
	else                                                                               remClass( $buttonRight, CLASS_BUTTON_INACTIVE );

	// calculate thumb size
	const $trackVer  = getChild( $elem,  1, 1 );
	const $trackUp   = getChild( $trackVer, 0 );
	const $thumbVer  = getChild( $trackVer, 1 );
	const $trackDown = getChild( $trackVer, 2 );

	const $trackHor   = getChild( $elem,  2, 1 );
	const $trackLeft  = getChild( $trackHor, 0 );
	const $thumbHor   = getChild( $trackHor, 1 );
	const $trackRight = getChild( $trackHor, 2 );

	const trackHeight = $trackVer.clientHeight;
	const trackWidth  = $trackHor.clientWidth;

	// height/width of track-up/track-left
	const trackUpHeight  = Math.floor( trackHeight * ( $viewport.scrollTop  / $viewport.scrollHeight ) );
	const trackLeftWidth = Math.floor( trackWidth  * ( $viewport.scrollLeft / $viewport.scrollWidth  ) );
	$trackUp  .style.height = trackUpHeight  + 'px';
	$trackLeft.style.width  = trackLeftWidth + 'px';

	// height/width of the thumb
	const thumbHeight = Math.ceil( trackHeight * visibleHeight );
	const thumbWidth  = Math.ceil( trackWidth  * visibleWidth  );
	$thumbVer.style.height = thumbHeight + 'px';
	$thumbHor.style.width  = thumbWidth  + 'px';

	// height/width of track-down/track-right
	const trackDownHeight = trackHeight - trackUpHeight  - thumbHeight;
	const trackRightWidth = trackWidth  - trackLeftWidth - thumbWidth;
	$trackDown .style.height = trackDownHeight + 'px';
	$trackRight.style.width  = trackRightWidth + 'px';
}

const update = ( $elem: HTMLElement ) => {
	const $viewport = $elem.children[0] as HTMLElement;

	const viewport  = $elem.clientHeight     + ',' + $elem.clientWidth     + '-' +
	                  $viewport.scrollHeight + ',' + $viewport.scrollWidth;
	const scrollbar = $viewport.scrollTop    + ',' + $viewport.scrollLeft;

	const dataOld = $viewport.dataset.scrollbarjs.split(' ');
	if( dataOld[0] !== viewport ){ // element or content size changed
		updateViewport( $elem, $viewport );
		updateScrollbars( $elem, $viewport );

	} else if( dataOld[1] !== scrollbar ) { // only scrollbar position changed
		updateScrollbars( $elem, $viewport );

	} else { // nothing changed, so nothing to do
		return;
	}

	$viewport.dataset.scrollbarjs = viewport + ' ' + scrollbar;
}

// keep it updated
requestAnimationFrame( function watch(){
	$ELEMS.forEach( update );
	requestAnimationFrame( watch );
} );



return {
	add  : add,
	init : init
}

}());
