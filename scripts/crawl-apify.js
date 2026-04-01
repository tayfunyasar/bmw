import { ApifyClient } from 'apify-client';

// TODO: Replace with your actual Apify API Token
const APIFY_TOKEN = process.env.APIFY_TOKEN || 'YOUR_APIFY_TOKEN_HERE';

// Initialize the ApifyClient with your API token
const client = new ApifyClient({
    token: APIFY_TOKEN,
});

const url = process.argv[2];

if (!url) {
    console.error('Lütfen bir URL sağlayın.');
    process.exit(1);
}

/**
 * Sends a request to an Apify Actor (e.g., a scraper)
 */
async function sendRequest() {
    try {
        console.log(`Sending request to Apify for URL: ${url}`);

        // Example: Running an actor (e.g., 'apify/web-scraper')
        // You should replace 'apify/web-scraper' with the actual actor ID you want to use
        const input = {
            startUrls: [{ url: url }],
            // Add other actor inputs here
        };

        // Run the actor and wait for it to finish
        const run = await client.actor('ivanvs/mobile-de-scraper').call(input);

        // Fetch and print actor results from the run's dataset (if any)
        console.log('Results from dataset:');
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        items.forEach((item) => {
            console.dir(item);
        });

        console.log('Request completed successfully.');
    } catch (error) {
        console.error('An error occurred:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }
}

sendRequest();
