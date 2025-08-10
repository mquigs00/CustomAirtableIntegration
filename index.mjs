import {format, parseISO} from 'date-fns';
import axios from 'axios';
import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";

/*
Example JSON received:
{
    "formId": "nVNBoEosh2us",
    "formName": "Middleware Test Form",
    "submission": {
        "submissionId": "0adb7f88-ea15-49ab-98e0-cf07a6fb2558",
        "submissionTime": "2025-07-16T14:14:01.335Z",
        "lastUpdatedAt": "2025-07-16T14:14:01.335Z",
        "questions": [
            {
                "id": "qC1W",
                "name": "First Name",
                "type": "ShortAnswer",
                "value": "Matt"
            },
            ...
*/

const client = new SecretsManagerClient({region: "us-east-1"});

/**
 * Retrieves a secret value from AWS Secrets Manager
 * 
 * @param {String} secretName
 * @returns the secret value
 */
async function getSecret(secretName) {
    const command = new GetSecretValueCommand({
        SecretId: secretName
    });
    const response = await client.send(command);

    if (response.SecretString) {
        return response.SecretString;
    }

    const buff = Buffer.from(response.SecretBinary, 'base64');
    return buff.toString('utf-8');
}

/**
 * Given the streetAddress, city, state, and zipcode, this function calls the OpenCage forward geocoding API to get the county
 * name
 * 
 * @param {String} streetAddress 
 * @param {String} city 
 * @param {String} state 
 * @param {String} zipcode 
 * @returns county
 */
async function getCounty(streetAddress, city, state, zipcode) {
    try {
        // retrieve the OpenCage API key
        const openCageSecret = await getSecret("OpenCageKey");
        const openCageKey = JSON.parse(openCageSecret).OPENCAGE_KEY;

        const addressQuery = `${streetAddress}, ${city}, ${state}, ${zipcode}`; // combine the given address components

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

        // retrieve the county value from the response body
        const body = response.data;
        let county = body.results[0].components.county;

        return county;
    } catch (error) {
        console.error("Error finding county: ", error);
    }
};

/**
 * Checks if there is already a Client record in the Airtable base with the same first name, last name, last four digits of SSN,
 * and date of birth
 * 
 * @param {String} firstName 
 * @param {String} lastName 
 * @param {String} dateOfBirth 
 * @param {String} lastFourOfSSN 
 * @returns true if the client already exists, false if not
 */
async function clientExists(firstName, lastName, dateOfBirth, lastFourOfSSN) {
    try {
        // retrieve the Airtable access token from AWS Secrets Manager
        const airtableSecret = await getSecret("AirtableToken");
        const airtableToken = JSON.parse(airtableSecret).AIRTABLE_TOKEN;

        // create our formula to call the Airtable List Records API and filter by formula to only receive records with
        // the given name, date of birth, and last four of SSN
        let formula = `AND(
            {First Name}='${firstName}',
            {Last Name}='${lastName}',
            {Birth Date}=DATETIME_PARSE('${dateOfBirth}', 'YYYY-MM-DD'),
            RIGHT({SSN}, 4)='${lastFourOfSSN}'
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

        // if any records were returned, then a client already exists with those attributes
        if (response.data.records.length > 0) {
            console.log(response.data.records);
            toReturn = true;
        }

        return toReturn;
    } catch (error) {
        console.error("Error checking if client exists", error);
    }
}

/**
 * Inserts a new Client record into Airtable
 * 
 * @param {Object} clientData - all of the client's required data for entry into Airtable
 */
async function insertClient(clientData) {
    try {
        // retrieve Airtable access token from AWS Secrets Manager
        const airtableSecret = await getSecret("AirtableToken");
        const airtableToken = JSON.parse(airtableSecret).AIRTABLE_TOKEN;

        console.log("Retrieved Airtable access token. Attempting to insert Client");

        const response = await axios.post(
            'https://api.airtable.com/v0/appsyRmBPaxsZIhaA/tbl4iFS1HK8fArCYg',
            {
                fields: {
                    "Fillout Id": clientData.filloutId,
                    "Rural Area Status": clientData.location.ruralAreaStatus,
                    "First Name": clientData.basic.firstName,
                    "Last Name": clientData.basic.lastName,
                    "Birth Date": clientData.basic.dateOfBirth,
                    "SSN": clientData.basic.ssn,
                    "Address": clientData.location.streetAddress,
                    "City": clientData.location.city,
                    "State": clientData.location.state,
                    "Zip": clientData.location.zipcode,
                    "County": clientData.location.county,
                    "Primary Phone Number": clientData.contact.phoneNumber,
                    "Primary Phone Type": clientData.contact.phoneType,
                    "Best Time To Contact": clientData.contact.bestTimeToContact,
                    "Email": clientData.contact.emailAddress,
                    "Preferred Contact Type": clientData.contact.preferredContactMethod,
                    "Purpose": clientData.housing.visitPurpose,
                    "How did you hear about us?": clientData.referralSource,
                    "Ethnicity": clientData.demographics.ethnicity,
                    "Highest Education": clientData.demographics.highestEducation,
                    "Household Type": clientData.family.householdType,
                    "Military Status": clientData.demographics.militaryStatus,
                    "Gender": clientData.demographics.gender,
                    "Race": clientData.demographics.race,
                    "Disabled": clientData.demographics.isDisabled,
                    "English Proficient": clientData.demographics.englishProficiency,
                    "Marital Status": clientData.demographics.maritalStatus,
                    "Preferred Language": clientData.demographics.preferredLanguage,
                    "Living Status": clientData.housing.currentLivingStatus,
                    "Cars": clientData.numCars,
                    "Dependents": clientData.family.numDependents,
                    "Number of Family members in the house": clientData.family.householdSize,
                    "Relationship": clientData.relationship,
                    "Colonias Resident": clientData.coloniasResident
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

        // get the detailed error response from Airtable
        if (error.response) {
            console.error("Status Code:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("No response received from Airtable");
        }
    }
};

/**
 * Given a question name ("First Name", "Date of Birth", etc.) the function provides it's value fromt the given question object
 * @param {Array} questions - the array of question objects from the Fillout webhook body
 * @param {String} questionName - the question whose answer is to be retrieved
 * @returns questionObj.value - the client's answer for the given question
 */
function getAnswerFromQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName); // find the question in the array

    // if the question is not found, throw an error providing which question could not be found
    if (questionObj === undefined) {
        throw new Error(`Question ${questionName} not found`);
    }

    return questionObj.value;
}

export const handler = async (event) => {
    let body = JSON.parse(event.body);
    let questions = body.submission.questions;                      // get the array of question object from the array

    const filloutId = body.submission.submissionId;

    const firstName = getAnswerFromQuestion(questions, "First Name");
    const lastName = getAnswerFromQuestion(questions, "Last Name");
    const dateOfBirth = getAnswerFromQuestion(questions, "Date of Birth");
    const lastFourOfSSN = getAnswerFromQuestion(questions, "Last 4 Digits of Social Security Number");

    console.log("Calling client exists");

    // check if the client already exists before proceeding with transforming and loading the data
    if (await clientExists(firstName, lastName, dateOfBirth, lastFourOfSSN)) {
        console.log("Client already exists in Airtable");
        const response = {
            statusCode: 200,
            body: JSON.stringify('Client already exists in Airtable'),
        };
        return response;
    }

    const paddedSSN = lastFourOfSSN.padStart(9, '0');
    const address = getAnswerFromQuestion(questions, "Address");
    const phoneNumber = getAnswerFromQuestion(questions, "Phone Number");
    const phoneType = getAnswerFromQuestion(questions, "Phone Type");
    const bestTimeToContact = getAnswerFromQuestion(questions, "Best Time to Contact");
    const emailAddress = getAnswerFromQuestion(questions, "Email Address");
    const preferredContactMethod = getAnswerFromQuestion(questions, "Preferred Contact Method");
    const visitPurpose  = getAnswerFromQuestion(questions, "Visit Purpose");
    const referralSource = getAnswerFromQuestion(questions, "How did you hear about us?");
    const ethnicity = getAnswerFromQuestion(questions, "Ethnicity");
    const highestEducation = getAnswerFromQuestion(questions, "Highest Education");
    const householdType = getAnswerFromQuestion(questions, "Household Type");
    const militaryStatus = getAnswerFromQuestion(questions, "Military Status");
    let gender = getAnswerFromQuestion(questions, "Gender");
    const race = getAnswerFromQuestion(questions, "Race");
    const englishProficiency = getAnswerFromQuestion(questions, "Are you proficient in English?");
    const maritalStatus = getAnswerFromQuestion(questions, "Marital Status");
    const preferredLanguage = getAnswerFromQuestion(questions, "Preferred Language");
    const currentLivingStatus = getAnswerFromQuestion(questions, "Current Living Status");
    const numCars = getAnswerFromQuestion(questions, "Number of Cars");
    const isDisabled = getAnswerFromQuestion(questions, "Disabled?");
    const numDependents = getAnswerFromQuestion(questions, "Number of Children Under 18");
    const householdSize = getAnswerFromQuestion(questions, "Number of People in Household");
    
    const dateOfBirthISO = format(parseISO(dateOfBirth), 'yyyy-MM-dd');

    const trimmedPhoneNumber = phoneNumber.substring(2);

    const streetAddress = address.address;
    const city = address.city;
    const state = address.state;
    const zipcode = address.zipCode;
    const county = await getCounty(streetAddress, city, state, zipcode);

    switch(gender) {
        case "M":
            gender = "Male";
            break;
        case "F":
            gender = "Female";
            break;
        case "O":
            gender = "Other";
            break;
    }
    
    const clientData = {
        basic: {
            firstName,
            lastName,
            dateOfBirth: dateOfBirthISO,
            ssn: paddedSSN
        },
        contact: {
            phoneNumber: trimmedPhoneNumber,
            phoneType,
            bestTimeToContact,
            emailAddress,
            preferredContactMethod
        },
        location: {
            streetAddress,
            city,
            state,
            zipcode,
            county,
            ruralAreaStatus: "Household does not live in a rural area"
        },
        demographics: {
            ethnicity,
            highestEducation,
            militaryStatus,
            gender,
            race,
            englishProficiency,
            maritalStatus,
            preferredLanguage,
            isDisabled,
        },
        family: {
            householdType,
            householdSize,
            numDependents,
        },
        housing: {
            currentLivingStatus,
            visitPurpose
        },
        numCars,
        referralSource,
        coloniasResident: "No",
        relationship: "Self",
        filloutId
    }
    
    console.log("Finished transforming data, calling insertClient");
    
    await insertClient(clientData);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
}