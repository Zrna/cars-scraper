/* eslint-disable no-undef */
const puppeteer = require('puppeteer');
const fs = require('fs');

const insertFilters = async (page) => {
  console.log('Inserting filters.');

  // brand
  await page.waitForSelector('div#selectator_markavozila');
  await page.click('div#selectator_markavozila');
  const carBrands = ['Audi', 'BMW', 'Mercedes-Benz'];
  for (const brand of carBrands) {
    await page.type('span.selectator_textlength', brand);
    await page.keyboard.press('Enter');
  }

  // price range
  await page.waitForSelector('input#price_from');
  await page.type('input#price_from', '5000');
  await page.waitForSelector('input#price_to');
  await page.type('input#price_to', '15000');

  // years range
  await page.waitForSelector('select#attr_Int_179');
  await page.select('#attr_Int_179', '2012');
  await page.waitForSelector('select#attr_Int_1190');
  await page.select('#attr_Int_1190', '');

  // mileage
  await page.waitForSelector('input#attr_Int_470');
  await page.type('input#attr_Int_910', '170000');

  // confirm inserted filters
  await page.click('input[type="submit"]');

  return carBrands;
};

const getCurrentDate = () => {
  const dateTime = new Date().toISOString();

  const day = dateTime.slice(8, 10);
  const month = dateTime.slice(5, 7);
  const year = dateTime.slice(0, 4);
  const fullDate = `${day}-${month}-${year}`;

  let hour = dateTime.slice(11, 13);
  hour = parseInt(hour) + 1; // CET
  const minute = dateTime.slice(14, 16);
  const second = dateTime.slice(17, 19);
  const fullTime = `${hour}${minute}${second}`;

  return [fullDate, fullTime];
};

const getNumberOfPages = async (page) => {
  await page.waitForSelector('ul.pagination');
  await page.click('ul.pagination > li:last-child');

  await page.waitForSelector('ul.pagination > li.active');
  const lastPageNumber = await page.evaluate(() => {
    return document.querySelector('ul.pagination > li.active').innerText;
  });

  await page.waitForSelector('ul.pagination');
  await page.click('ul.pagination > li:first-child');

  return lastPageNumber;
};

const scrape = async (page) => {
  const numberOfPages = await getNumberOfPages(page);
  console.log('Number of pages:', numberOfPages);

  await page.waitForSelector('a.result');

  const data = await page.evaluate(() => {
    const ads = document.querySelectorAll('a.result');
    const adsArray = Array.from(ads);

    return adsArray.map(ad => ({
      link: ad.getAttribute('href') === null ? '' : ad.getAttribute('href'),
      title: ad.querySelector('span.title') === null ? '' : ad.querySelector('span.title').innerText,
      description: ad.querySelector('span.lead') === null ? '' : ad.querySelector('span.lead').innerText,
      tags: ad.querySelector('ul.tags') === null ? '' : ad.querySelector('ul.tags').innerText.replace(' : ', ':'),
      location: ad.querySelector('li.icon-marker') === null ? '' : ad.querySelector('li.icon-marker').innerText,
      published: ad.querySelector('li.icon-time') === null ? '' : ad.querySelector('li.icon-time').innerText.replace('Objava ', ''),
      price: ad.querySelector('span.price') === null ? '' : ad.querySelector('span.price').innerText
    }));
  });

  return data;
};

const generateFileName = async () => {
  const date = getCurrentDate();
  const fileName = `result_${date[0]}_${date[1]}.json`;
  console.log('File name:', fileName);
  return fileName;
};

// eslint-disable-next-line no-unused-vars
const takePageScreenshot = async (page) => {
  console.log('Taking screenshot.');
  const date = getCurrentDate();
  const screenshotName = `screenshot_${date[0]}_${date[1]}.png`;

  console.log('Screenshot name:', screenshotName);
  await page.screenshot({ path: `img/${screenshotName}` });
};

// main function
(async () => {
  const browser = await puppeteer.launch({ headless: false, ignoreHTTPSErrors: true });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  console.log('Loading page.');
  await page.goto('https://www.index.hr/oglasi/', { waitUntil: 'networkidle2' });

  console.log('Accepting cookies.');
  await page.waitForSelector('div.cookie-consent-container');
  await page.click('body > div.cookie-consent-container > div > button');

  console.log('Navigating to Cars page.');
  await page.waitForSelector('a[href="https://www.index.hr/oglasi/osobni-automobili/gid/27"');
  await page.click('a[href="https://www.index.hr/oglasi/osobni-automobili/gid/27"');

  await page.waitForSelector('div#selectator_markavozila');
  console.log('Cars page loaded.');

  // inserting filters and saving car brands names in one step
  // carBrands is used when creating the results file to show which brands are filtered
  const carBrands = await insertFilters(page);

  console.log('Start scraping.');
  await page.waitForSelector('div.OglasiRezHolder');
  const scrapedData = await scrape(page);

  console.log('Done with scraping. Saving data file.');
  const fileName = await generateFileName();
  const results = [carBrands, scrapedData];
  fs.writeFile(`result/${fileName}`, JSON.stringify(results), (err) => {
    if (err) throw err;
  });

  await takePageScreenshot(page);

  console.log('Done. \nClosing the browser.');
  await browser.close();
})();
