// add the copyright banner to the top of the min.js file

const prependFile = require('prepend-file');
const {version, license, homepage} = require('../package.json');

const repositoryName = homepage.split('/').pop();
const banner = `// ${repositoryName} v${version} | ${license} | ${homepage}\n`;

prependFile('dist/scrollbar.js', banner, (error) => {
	if( error ) throw error;
});