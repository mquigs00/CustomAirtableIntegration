import {format, parseISO} from 'date-fns';
import axios from 'axios';
import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({region: "us-east-1"});

/**
 * Retrieves a secret valie from AWS Secrets Manager
 * @param {String} secretName 
 * @returns 
 */
async function getSecret(secretName) {
    const command = new GetSecretValueCommand({
        SecretId: secretName
    });
    const response = await client.send(command);

    // if a secret was found, return it. Otherwise throw an error
    if (response.SecretString) {
        return response.SecretString;
    } else {
        throw new Error("Secret not found for " + secretName);
    }
}

/**
 * Given an street address, city, state, and zipcode, this function calls the Opencage API and returns the corresponding county name
 * 
 * @param {String} streetAddress 
 * @param {String} city 
 * @param {String} state 
 * @param {String} zipcode 
 * @returns county
 */
async function getCounty(streetAddress, city, state, zipcode) {
    try {
        const openCageSecret = await getSecret("OpenCageKey");
        const openCageKey = JSON.parse(openCageSecret).OPENCAGE_KEY;
        const addressQuery = `${streetAddress}, ${city}, ${state}, ${zipcode}`;

        const response = await axios.get(
            'https://api.opencagedata.com/geocode/v1/json',
            {
                params: {
                    key: openCageKey,
                    q: addressQuery,
                    limit: 1
                }
            }
        );

        const body = response.data;
        let county = body.results[0].components.county;
        return county;
    } catch (error) {
        console.error("Error finding county: ", error);
    }
};

/**
 * Given a Fillout.com submission, this function checks if a record already exists in Airtable with that name and choices
 * 
 * @param {Object} filloutData 
 * @returns 
 */
async function matchExists(filloutData) {
    try {
        const airtableSecret = await getSecret("AirtableToken");
        const airtableToken = JSON.parse(airtableSecret).AIRTABLE_TOKEN;

        // Airtable allows you to call their listRecords API and include a formul to filter by
        let formula = `AND(
            {First Name}='${filloutData.firstName}',
            {Favorite Ice Cream Flavor}='${filloutData.favoriteFlavor}',
            {Jordan or Lebron}='${filloutData.jordanOrLebron}',
            {Beatles or Stones}='${filloutData.beatlesOrStones}'
        )`;

        console.log("Retrieved tokens and created formula. Calling axios.get");
        const response = await axios.get(
            'https://api.airtable.com/v0/appsyRmBPaxsZIhaA/tbl4iFS1HK8fArCYg',
            {
                headers: {
                    'Authorization': `Bearer ${airtableToken}`
                },
                params: {
                    filterByFormula: formula
                }
            }
        );

        let toReturn = false;

        // if any matching records were found, return true
        if (response.data.records.length > 0) {
            console.log(response.data.records);
            toReturn = true;
        }
        return toReturn;
    } catch (error) {
        console.error("Error checking if matching record exists", error);
    }
}

/**
 * Given a Fillout.com submission, this function inserts a new record into Airtable
 * 
 * @param {Object} filloutData 
 */
async function insertRecord(filloutData) {
    try {
        console.log("Attempting to Insert Client");
        const airtableSecret = await getSecret("AirtableToken");
        const airtableToken = JSON.parse(airtableSecret).AIRTABLE_TOKEN;

        //console.log(clientData);

        const response = await axios.post(
            'https://api.airtable.com/v0/appsyRmBPaxsZIhaA/tbl4iFS1HK8fArCYg',
            {
                fields: {
                    "Fillout Id": filloutData.filloutId,
                    "First Name": filloutData.firstName,
                    "Date": filloutData.dateISO,
                    "Favorite Ice Cream Flavor": filloutData.favoriteFlavor,
                    "Jordan or Lebron": filloutData.jordanOrLebron,
                    "Beatles or Stones": filloutData.beatlesOrStones,
                    "Address": filloutData.streetAddress,
                    "City": filloutData.city,
                    "State": filloutData.state,
                    "Zip": filloutData.zipcode,
                    "County": filloutData.county,
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${airtableToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("Client Inserted")
    } catch (error) {
        console.error("Error inserting client", error);

        if (error.response) {
            console.error("Status Code:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("No response received from Airtable");
        }
    }
};

export const handler = async (event) => {
    console.log(JSON.stringify(event, null, 2));
    const expectedSecret = await getSecret("FILLOUT_SECRET");
    const incomingSecret = event.headers['x-webhook-secret'];

    if (!incomingSecret) {
        console.log("Webhook secret invalid");
        return {
            statusCode: 401,
            body: JSON.stringify('Incorrect webhook secret'),
        };
    } else {
        console.log("Webhook secret verified");
    }

    let body = JSON.parse(event.body);
    let {filloutId, firstName, date, favoriteFlavor, jordanOrLebron, beatlesOrStones, streetAddress, city, state, zipcode} = body;

    const dateISO = format(parseISO(date), 'yyyy-MM-dd');
    const county = await getCounty(streetAddress, city, state, zipcode);

    console.log("Calling client exists");
    
    const filloutData = {
        filloutId,
        firstName,
        favoriteFlavor,
        jordanOrLebron,
        beatlesOrStones,
        dateISO,
        streetAddress,
        city,
        state,
        zipcode,
        county
    };

    // if client
    if (await matchExists(filloutData)) {
        console.log("Matching record already exists in Airtable");
        const response = {
            statusCode: 200,
            body: JSON.stringify('Matching record already exists in Airtable'),
        };
        return response;
    } else {
        console.log("No matching record found. Inserting record");
        await insertRecord(filloutData);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify('New record added to Airtable!'),
    };

    return response;
}