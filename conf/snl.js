
module.exports = {
    template: './conf/snl.yaml',
    ftp_connection: 'SNL_FTP',
    api_connection: 'SNL_API',
    includeColumn: (column) => true,
    processSheet: (sheetname) => true,  
    fileToDataset: (filename, inflector) => inflector.underscore(filename.split("_")[0]),
    sheetnameToPipelineId: (sheetname, inflector) => sheetname.toLowerCase(),
    standardizePath: (path, inflector) => path,  
    standardizeSchemaPattern: (path, inflector) => path,  
    standardizePattern: (pattern, inflector) => pattern,  
    standardizeColumn: (column, inflector) => {
        column = column.trim();

        if(/^\d/.test(column)){
            column = `_${column}`;
        }

        return column
                    .replace("%", "PERCENT")
                    .replace("$", "DOLLAR")
                    .replace("¢", "CENTS")
                    .replace("°", "DEGREES")
                    .replace("³", "CUBED")
                    .replace(/[\W_]+/g, " ")
                    .trim()
                    .replace(/ {1,}/g, "_");
    },
    standardizeSheetname: (sheetname, inflector) => sheetname,
    db2Crux: (type) => {
        switch(type){
            case 'char':
            case 'nchar':
            case 'varchar':
            case 'varchar(max)':
            case 'nvarchar':
            case 'nvarchar(max)':
                return { type: "STRING" }
            case 'tinyint':
            case 'bigint':
                return { type: "INTEGER" }
            case 'float':
                return { type: "FLOAT" }
            case 'bit':
                return { type: "BOOLEAN" }
            case 'date':
                return { type: "DATE", format: "%Y-%m-%d" }
            case 'datetime':
            case 'smalldatetime':
                return { type: "DATETIME", format: "%m/%d/%Y %H:%M:%S %p" }
            default:
                throw `unknown type :${type}`;
        }
    },
};