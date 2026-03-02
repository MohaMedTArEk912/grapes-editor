const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function test() {
    try {
        const completion = await client.chat.completions.create({
            model: 'google/gemma-3-4b-it:free',
            messages: [{ role: 'user', content: 'Hello' }],
        });
        console.log('Success:', completion.choices[0].message.content);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

test();
