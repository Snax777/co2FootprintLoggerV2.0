function getUTCDateAndTime(date) {
    return date.toISOString().split('T');
}

function formatToGBLocale(date) {
    return date.toLocaleDateString("en-GB");
}

function getMondayDateAndTime(date) {
    let mondayDate = new Date(date);
    const dayOfWeek = mondayDate.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    mondayDate.setDate(mondayDate.getDate() - daysSinceMonday);
    mondayDate.setHours(0, 0, 0, 0);

    return getUTCDateAndTime(mondayDate);
}

function getSundayDateAndTime(date) {
    let sundayDate = new Date (getMondayDateAndTime(date)[0]);

    sundayDate.setDate(sundayDate.getDate() + 6);
    sundayDate.setHours(23, 59, 59, 999);

    return getUTCDateAndTime(sundayDate);
}

export { 
    getUTCDateAndTime as getUTC, 
    formatToGBLocale, 
    getMondayDateAndTime, 
    getSundayDateAndTime
};