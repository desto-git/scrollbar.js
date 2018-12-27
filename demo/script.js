var paragraphs = [
	'Magni veniam iste aut nemo. Id atque quia cum totam dolore velit. Rerum dignissimos modi et alias non aliquid dolorem. Est perspiciatis commodi aut accusamus eos maxime itaque quos.<br>Quos delectus ipsam dicta voluptas quo earum aut inventore. Modi sequi quo excepturi recusandae minima aut corrupti.',
	'Et aut reprehenderit blanditiis est eum ratione inventore harum. Eaque nihil quis ut veniam fugiat. Iste inventore voluptatum rerum eius nesciunt saepe.<br>Et et mollitia aliquam quaerat. Minus iusto voluptatem possimus.',
	'Odit quis cupiditate aut. Nisi quam est est officia. Quo dolor laboriosam excepturi iure cum harum eaque et.<br>Dolorem vitae accusamus et enim eaque minima nihil. Saepe minima quia libero beatae labore consequatur dicta omnis. Veritatis ut aut id exercitationem molestiae.',
	'Suscipit soluta quia magni. Eum ipsa architecto aut facilis est rerum dolorem quas. Totam perferendis tenetur vel minima odio autem magni non.<br>Officia in voluptatibus facere tempore voluptatem aut odio nam. Ipsum voluptatibus excepturi sint quis et molestias. Ab consequatur enim eos nostrum ullam.',
	'Rerum sit veniam sapiente. Dolores sequi rem accusantium.<br>Perspiciatis ut ratione modi ut ut et consequatur. Iusto sit cupiditate suscipit temporibus officia. Autem aspernatur odit impedit enim doloremque ea.'
];
var pIndex = 0;

function addP( $target, amount ){
	for( var i = 0; i < amount; ++i ){
		$target.innerHTML += '<p class="lorem">' + paragraphs[ pIndex ] + '</p>';

		++pIndex;
		pIndex %= paragraphs.length;
	}
}

var $content = document.getElementsByClassName('content');
for( var i = 0; i < $content.length; ++i ){
	addP( $content[i], paragraphs.length );
}



// link issues
var $a = document.getElementsByTagName('a');
for( var i = 0; i < $a.length; ++i ){
	if( $a[i].innerHTML.indexOf('#') === 0 )
		$a[i].href = 'https://github.com/desto-git/scrollbar.js/issues/' + $a[i].innerHTML.substr(1);
}



// theme selection
var $theme = document.getElementById('theme');
var $sbjs = document.getElementsByClassName('sbjs');

function selectTheme( themeName ){
	$theme.href = '../src/scrollbar-' + themeName + '.css';
}

$theme.addEventListener('load', function(){
	// when elements are added to scrollbarjs before styling is applied, the calculation of the thumb height cannot work correctly
	// to help this, an update needs to be triggered. this is done by just scrolling by one pixel in this case
	for( var i = 0; i < $sbjs.length; ++i ){
		if( !$sbjs[i].classList.contains('scrollbarjs') ) continue;

		var $target = $sbjs[i].children[0];
		var scrollTop = $target.scrollTop;
		console.log(scrollTop);
		// add some delay, otherwise the change happens too fast for the update to notice
		$target.scrollTop += 1;
		requestAnimationFrame(function(){
			$target.scrollTop -= 1; // in case the container was already scrolled to the bottom
			requestAnimationFrame(function(){
				$target.scrollTop = scrollTop;
			});
		});
	}
});