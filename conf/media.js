

module.exports = 
{
    ftp_connection: 'SNL_MEDIA_FTP',
    api_connection: 'SNL_MEDIA_API',

    in: "./.data/Media/*.xlsx",
    out: "./.out/Media",

    dataset: ["snl", "media"],
    fileToDataset: (filename, inflector) => {
        var dataset = filename.split("_")[0]
                        .replace("GAAP", "Gaap")
                        .replace("TV", "Tv")
                        .replace("IDs", "Ids");

        return inflector.underscore(dataset);
    },
    standardizePath: (path) => {
        if(!path.includes("Media"))
            path = path.replace("/110866/", "/110866/Media/");

        return path
            // .replace("MMCompanies", "Companies")
            .replace("yyyyMMdd", "{FD_YYYYMMDD}")
            .replace("[Industry]", "GAAP");
    },  
    standardizeSchemaPattern: (path) => {
        if(path.endsWith(".zip"))
            path = path.replace(".zip", ".txt");
        if(!path.endsWith(".txt"))
            path = `${path}.txt`;

        return path
            .replace(".txt", "\\.txt")
            .replace("yyyyMMdd", "{FD_YYYYMMDD}D*")
            .replace("[v]", "\\d+")
            .replace("[Industry]", "Media");
    },  
    standardizePattern: (pattern) => {
        return pattern
            .replace(".zip", "\\.zip")
            .replace("[v]", "\\d+")
            .replace("yyyyMMdd", "{FD_YYYYMMDD}")
            // .replace("MMProjects", "ExplorationBudget")
            .replace("[Industry]", "Media");
    },  
    standardizeSheetname: (sheetname) => {
        return sheetname
            // .replace("IntermediaryProductsAndConcent", "IntermediaryProductsAndConcentrates")
            // .replace("AttributableReservesandResourc", "AttributableReservesandResources")
            .replace("(Industry)", "Media");
    },   
    tempPipelineMatcher: (sheetname) => {
        if(sheetname == "Corporate")
            return {
                name: "MediaGAAP_Corporate", 
                replace: false,
                matchStart: true,
            };

        if(sheetname.startsWith("Return_") || sheetname.startsWith("Rates_"))
            return {
                name: `${sheetname.split("_")[0]}_[type]`, 
                replace: true,
                matchStart: false,
            };

        if(sheetname == "UniversalIDs_Media")
            return {
                name: sheetname, 
                replace: false,
                matchStart: true,
            };

        return {
            name: sheetname, 
            replace: false,
            matchStart: false,
        };
    },

    processSheet: (sheetname) => sheetname != "Summary" && !sheetname.startsWith("ER Diagram") && sheetname != "Sheet1",    
}