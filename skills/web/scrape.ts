import { Skill } from '../index';

export const scrapeSkill: Skill = {
  name: 'scrape',
  description: 'Scrape and extract data from websites',
  aliases: ['crawl', 'extract', 'fetch'],
  category: 'web',
  requiredTools: ['web_scraper', 'python_executor', 'file_writer'],
  parameters: [
    {
      name: 'url',
      description: 'URL to scrape',
      required: true,
      type: 'string',
    },
    {
      name: 'format',
      description: 'Output format: json, csv, markdown',
      required: false,
      type: 'string',
      default: 'json',
    },
  ],
  systemPrompt: `You are a web scraping expert. Your task is to extract structured data from websites.

Scraping approach:
1. Analyze page structure
2. Identify data patterns
3. Extract relevant content
4. Clean and structure data
5. Handle pagination if needed

Best practices:
- Respect robots.txt
- Use appropriate delays between requests
- Handle errors gracefully
- Validate extracted data
- Cache results when appropriate

Data extraction:
- Use CSS selectors for precision
- Handle dynamic content (JavaScript-rendered)
- Extract metadata when useful
- Clean HTML entities and whitespace
- Convert to requested format`,

  userPromptTemplate: `Scrape website:

URL: {url}
Output format: {format}

{userInput}

Please:
1. Fetch the webpage
2. Analyze structure
3. Extract requested data
4. Clean and format output
5. Save to file if requested`,
};
