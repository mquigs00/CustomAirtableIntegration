# CustomAirtableIntegration

The goal of this project is to create a middleware function that will receive a webhook with a client's digital form submission, transform the data to fit the Airtable requirements, and insert the Client to the table if they are not already added.

This project was inspired by my work re-designing the data system for an organization that was previously using paper intake forms to
gather client data with 30+ mandatory fields. Clients would have to fill out the paper form at the beginning of the first
appointment, wasting valuable time that they could be getting their case started with the employee. After appointments, the
employee would then have to manually enter the clients data to create a new client in the case management system. I set up
an cost-effective subscription with Fillout.come so clients could efficiently fill out all of their data before coming into the
appointment so all appointment time could be effectively used. Fillout.come would map the clients answers to the original client intake form so that a PDF copy could be saved for record keeping and additional info that the CMS did not require. I then wrote this middleware function to receive the form submission, transform the values and add any necessary data to fit the CMS Client form requirements, and insert the new client. In order to avoid adding duplicate clients who have already had cases with the organization, the function initially makes an API request to the Client table to see if a client with the same first name, last name, date of birth, and last four digits of SSN exists. If not, the function continues with the transformation and insertion of the client data.
