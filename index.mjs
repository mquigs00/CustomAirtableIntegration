import {format, parseIso} from 'date-fns';
import axios from 'axios';

async function clientExists(firstName, lastName, dateOfBirth, ssn) {
    try {
        const airtableTokenName = "AirtableMiddlewareTest";
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
                    'Authorization': 'Bearer '
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

function getAnswerFromQuestion(questions, questionName) {
    const questionObj = questions.find(question => question.name === questionName);
    return questionObj.value;
}

export const handler = async (event) => {
    let body = JSON.parse(event.body);
    let questions = body.submission.questions;

    const firstName = getAnswerFromQuestion(questions, "First Name");
    const lastName = getAnswerFromQuestion(questions, "Last Name");
    const dateofBirth = getAnswerFromQuestion(questions, "Date of Birth");
    const lastFourofSSN = getAnswerFromQuestion(questions, "Last 4 of Social Security Number");
    const paddedSSN = lastFourofSSN.padStart(9, '0');
    const dateOfBirthISO = parseISO(dateofBirth);

    clientExists(firstName, lastName, dateOfBirthISO, paddedSSN);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
}