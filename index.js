const puppeteer = require("puppeteer");
const fs = require("fs");
const ProgressBar = require("./helpers/ProgressBar");

const Bar = new ProgressBar();

(async () => {
  console.log("Warming up a scrapper");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("https://www.goodreads.com/choiceawards/best-books-2018", {
    waitUntil: "domcontentloaded"
  });

  const results = [];

  const categoriesNames = await page.$$eval(".category h4", names =>
    names.map(name => name.innerText)
  );

  categoriesNames.forEach(name => results.push({ category: name }));

  const categoriesLinks = await page.$$eval(".category > a", links =>
    links.map(link => link.href)
  );

  Bar.init(categoriesNames.length);

  for (let i = 0; i < categoriesLinks.length; i++) {
    const books = [];
    await page.goto(categoriesLinks[i], {
      waitUntil: "domcontentloaded"
    });

    const booksVotes = await page.$$eval(
      ".pollAnswer > .result:first-child",
      votes =>
        votes.map(result =>
          parseInt(result.innerText.split(" ")[0].replace(",", ""))
        )
    );
    booksVotes.forEach(votes => books.push({ votes }));

    const booksLinks = await page.$$eval(".pollAnswer__bookLink", links =>
      links.map(link => link.href)
    );
    for (let j = 0; j < booksLinks.length; j++) {
      await page.goto(booksLinks[j], {
        waitUntil: "domcontentloaded"
      });
      const bookProps = await page.evaluate(() => {
        const cover = document.querySelector("#coverImage").getAttribute("src");
        const title = document.querySelector("#bookTitle").innerText;
        const author = document.querySelector(".authorName").innerText;
        return { cover, title, author };
      });
      books[j] = Object.assign(bookProps, books[j]);
      Bar.update(i + (1 / booksLinks.length) * (j + 1));
    }

    results[i].books = books;
  }

  fs.writeFile("results.json", JSON.stringify(results), function(err) {
    if (err) throw err;
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    console.log("Complete!");
    browser.close();
  });
})();
