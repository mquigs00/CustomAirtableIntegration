import {format, parseISO} from 'date-fns';
import axios from 'axios';
import {SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({region: "us-east-1"});

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

async function clientExists(firstName, lastName, dateOfBirth, ssn) {
    try {
        const airtableTokenName = "AirtableMiddlewareTest";
        const airtableToken = await getSecret(airtableTokenName);

        const options = {
            hostName: 'localhost',
            port: 2773,
            path: `/secretsmanager/get?secretId=${secretName}`,
        }
        let formula = `AND(
            {First Name}='${first_name}',
            {Last Name}='${last_name}',
            {Date of Birth}=DATETIME_PARSE('${dateOfBirth}', 'YYYY-MM-DD'),
            {SSN}='${ssn}'
        )`;
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
    } catch {
        console.error("Error checking if client exists", error);
    }
}

async function insertClient(clientData) {
    try {
        console.log("Attempting to Insert Client");
        const airtableSecret = await getSecret("AirtableToken");
        const airtableToken = JSON.parse(airtableSecret).AIRTABLE_TOKEN;

        console.log(clientData);

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
    } catch (error) {
        console.error("Error inserting client", error);
    }
};

function getAnswerFromQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);

    if (questionObj === undefined) {
        throw new Error(`Question ${questionName} not found`);
    }

    return questionObj.value;
}

export const handler = async (event) => {
    let body = JSON.parse(event.body);
    let questions = body.submission.questions;

    const filloutId = body.submission.submissionId;

    console.log("Body", body);
    const firstName = getAnswerFromQuestion(questions, "First Name");
    
    const lastName = getAnswerFromQuestion(questions, "Last Name");
    const dateOfBirth = getAnswerFromQuestion(questions, "Date of Birth");
    const lastFourOfSSN = getAnswerFromQuestion(questions, "Last 4 Digits of Social Security Number");
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
    const county = "test";

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
    
    //clientExists(firstName, lastName, dateOfBirthISO, paddedSSN);
    
    const clientData = {
        basic: {
            firstName,
            lastName,
            dateOfBirth: dateOfBirthISO,
            ssn: lastFourOfSSN
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