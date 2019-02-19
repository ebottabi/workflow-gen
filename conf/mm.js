

module.exports = 
{
    ftp_connection: 'SNL_METALS_MINING_FTP',
    api_connection: 'SNL_METALS_MINING_API',

    in: "./.data/Metals_Mining/*.xlsx",
    out: "./.out/Metals_Mining",

    dataset: ["snl", "metals_mining"],
    standardizePath: (path) => {
        if(!path.includes("MetalsMining"))
            path = path.replace("/110866/", "/110866/MetalsMining/");

        return path
            .replace("MMCompanies", "Companies")
            .replace("yyyyMMdd", "{FD_YYYYMMDD}")
            .replace("[Industry]", "Companies");
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
            .replace("[Industry]", "MetalsMining");
    },  
    standardizePattern: (pattern) => {
        return pattern
            .replace(".zip", "\\.zip")
            .replace("[v]", "\\d+")
            .replace("yyyyMMdd", "{FD_YYYYMMDD}")
            .replace("MMProjects", "ExplorationBudget")
            .replace("[Industry]", "MetalsMining");
    },  
    standardizeSheetname: (sheetname) => {
        return sheetname
            .replace("IntermediaryProductsAndConcent", "IntermediaryProductsAndConcentrates")
            .replace("AttributableReservesandResourc", "AttributableReservesandResources")
            .replace("(Industry)", "MetalsMining");
    },  
    tempPipelineMatcher: (sheetname) => {
        if(sheetname.startsWith("Return_") || sheetname.startsWith("Rates_"))
            return {
                name: `${sheetname.split("_")[0]}_[type]`, 
                replace: true,
                matchStart: false,
            };

        return {
            name: sheetname, 
            replace: false,
            matchStart: false,
        };
    },

    processSheet: (sheetname) => sheetname != "Summary" && !sheetname.startsWith("ER Diagram") && sheetname != "Sheet1",    
}