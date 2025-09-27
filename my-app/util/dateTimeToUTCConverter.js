function getUTCDateAndTime(date) {
    return date.toISOString().split('T');
}

function formatToGBLocale(date) {
    return date.toLocaleDateString("en-GB");
}

function getMondayDateAndTime(date = "") {
    let mondayDate = date ? new Date(date) : new Date();
    const dayOfWeek = mondayDate.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    mondayDate.setDate(mondayDate.getDate() - daysSinceMonday);
    mondayDate.setHours(0, 0, 0, 0);

    return getUTCDateAndTime(mondayDate);
}

function getSundayDateAndTime(date = "") {
    if (!date) {
        date = new Date();
    }

    let sundayDate = new Date (getMondayDateAndTime(date)[0]);

    sundayDate.setDate(sundayDate.getDate() + 6);
    sundayDate.setHours(23, 59, 59, 999);

    return getUTCDateAndTime(sundayDate);
}

function getEarlyDate(dateRange = 0) {
    const currentMilliseconds = Date.now();
    const earlyMilliseconds = currentMilliseconds - (dateRange * 24 * 60 * 60 * 1000);

    return getUTCDateAndTime(new Date(earlyMilliseconds))[0];
}

export { 
    getUTCDateAndTime as getUTC, 
    formatToGBLocale, 
    getMondayDateAndTime, 
    getSundayDateAndTime, 
    getEarlyDate
};