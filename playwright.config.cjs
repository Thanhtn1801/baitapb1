const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser',timeout:60000,workers:1,reporter:'list',use:{headless:true},outputDir:'/tmp/flow-browser-results'});
