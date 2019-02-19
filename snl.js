"use strict";

const glob = require("glob");
const Inflector = require('inflector-js');
const XLSX = require('xlsx');
const fs = require('fs');
const Handlebars = require('handlebars');


const config = Object.assign(require("./conf/snl.js"), require(`./conf/${process.argv[2]}.js`));

const outDir = `${config.out}/${config.dataset.join("/")}`;
fs.mkdirSync(outDir, { recursive: true });

const template = Handlebars.compile(fs.readFileSync(config.template).toString());

glob(config.in, {}, function (er, files) {
    if(er)
        throw er;

    if(!files)
        throw 'No files found';

    let types = [];
    let special = [];
    for(let file of files) {
        let dataset = config.fileToDataset(file.split("/").slice(-1)[0], Inflector);
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~");
        console.log(`Processing file: ${file} as dataset: ${dataset}`);

        let workbook = XLSX.readFile(file);
        
        let summary = workbook.Sheets["Summary"];
        let row = 1;
        
        let profile = {
            daily: {},
            history: {},
            schemas: [],
            pipelines: {},
        };

        console.log("Building profile");
        while(row < 1000) {
            let cell = summary[`A${row}`];

            if(cell && cell.v.startsWith("Full Files")) {
                profile.daily.paths = {
                    full: config.standardizePath(summary[`B${row}`].v, Inflector),
                    deltas: config.standardizePath(summary[`B${row + 1}`].v, Inflector),
                };

                if(summary[`C${row}`])
                    profile.history.paths = {
                        full: config.standardizePath(summary[`C${row}`].v, Inflector),
                        deltas: config.standardizePath(summary[`C${row + 1}`].v, Inflector),
                    };
            }
            
            if(cell && cell.v == "Zip Package Name for Full Files") {
                profile.daily.patterns = {
                    full: config.standardizePattern(summary[`B${row}`].v, Inflector),
                    deltas: config.standardizePattern(summary[`B${row + 1}`].v, Inflector),
                };

                if(summary[`C${row}`] && summary[`C${row}`].v.includes("History"))
                    profile.history.patterns = {
                        full: config.standardizePattern(summary[`C${row}`].v, Inflector),
                        deltas: config.standardizePattern(summary[`C${row + 1}`].v, Inflector),
                    };
            }

            if(cell && cell.v == "Full File Name") {
                for(row; row++; row < 10000) {
                    if(!summary[`A${row}`] || (summary[`A${row}`].v !== 0 && !summary[`A${row}`].v))
                        break;

                    profile.schemas.push({
                        pattern: config.standardizeSchemaPattern(summary[`A${row}`].v),
                        history: summary[`E${row}`] && summary[`E${row}`].v.toLowerCase() == "yes" || false,
                    });
                }

                break;
            }

            row++;
        }
        
        for(let sheetname of workbook.SheetNames) {
            if(!config.processSheet(sheetname)) {
                console.log(`Ignoring sheet: ${sheetname}`);
                continue;
            }

            console.log(`Processing sheet: ${sheetname}`);

            let sheet = workbook.Sheets[sheetname];
            sheetname = config.standardizeSheetname(sheetname);

            let pipelineId = config.sheetnameToPipelineId(sheetname, Inflector);
            profile.pipelines[sheetname] = {
                id: pipelineId,
                columns: [],
            };


            console.log("Attributes:",{sheetname, pipelineId});
            
            let row = 1;
            while(row < 10000) {
                let cell = sheet[`A${row}`];

                if(cell && cell.v == "Ordinal") {
                    for(row; row++; row < 10000) {
                        if(!sheet[`D${row}`] || (sheet[`D${row}`].v !== 0 && !sheet[`D${row}`].v))
                            break;
    
                        // console.log("Processing column", {
                        //     name: sheet[`D${row}`].v,
                        //     type: sheet[`E${row}`].v,
                        // });

                        profile.pipelines[sheetname].columns.push({
                            db: {
                                name: sheet[`D${row}`].v,
                                type: sheet[`E${row}`].v,
                            },
                            crux: {
                                name: config.standardizeColumn(sheet[`D${row}`].v, Inflector),
                                spec: config.db2Crux(sheet[`E${row}`].v),
                            } 
                        });

                        types.push(sheet[`E${row}`].v);
                        special = special.concat(sheet[`D${row}`].v.match(/[^\w\s]/g));
                    }
    
                    break;
                }

                row++;
            }
        }


        console.log("Exporting profile");
        fs.writeFileSync(`${config.out}/${dataset}.profile.json`, JSON.stringify(profile, null, 2)); 
        let workflowIdStub = `${config.dataset.join("_")}_${dataset}`;

        
        /// daily
        let dailyPipelines = [];
        let historyPipelines = [];

        console.log("Exporting pipelines");
        for(let n in profile.pipelines) {
            let pipeline = profile.pipelines[n];
            console.log("Preparing pipeline:", pipeline.id);

            let matcher = config.tempPipelineMatcher(n);

            let schemas;
            if(matcher.matchStart)
                schemas = profile.schemas.filter(s => s.pattern.startsWith(`${matcher.name}_`));
            else {
                schemas = profile.schemas.filter(s => s.pattern.includes(`_${matcher.name}_`));

                if(!schemas.length && matcher.name != n)
                    schemas = profile.schemas.filter(s => s.pattern.includes(`_${n}_`));
            }

            if(schemas.length == 0)
                throw `failed to locate schema for pipeline: ${n}`
            else if(schemas.length > 1)
                throw [`matched too many schemas for pipeline: ${n} with id: ${pipeline.id}`, JSON.stringify(schemas)];
            
            dailyPipelines.push({
                id: pipeline.id,
                file_pattern: matcher.replace ? schemas[0].pattern.replace(matcher.name, n) : schemas[0].pattern,
                fields: pipeline.columns.map(c => {return {name: c.crux.name, spec: c.crux.spec};}),
            });

            if(schemas[0].history)
                historyPipelines.push({
                    id: pipeline.id,
                    file_pattern: matcher.replace ? schemas[0].pattern.replace(matcher.name, n) : schemas[0].pattern,
                    fields: pipeline.columns.map(c => {return {name: c.crux.name, spec: c.crux.spec};}),
                });
        }

        let workflowVars = {
            ftp_conn_var: config.ftp_connection,
            api_conn_var: config.api_connection,
            workflow_id: `${workflowIdStub}_daily_full`,
            workflow_pattern: profile.daily.patterns.full,
            workflow_path: profile.daily.paths.full,
            pipelines: dailyPipelines,
        };

        console.log("Exporting daily full");
        Handlebars.registerHelper("mod", (str) => str.replace("D*", "") );
        let workflow = template(workflowVars);
        fs.writeFileSync(`${outDir}/${workflowIdStub}_daily_full.yaml`, workflow);
        
        console.log("Exporting daily deltas");
        Handlebars.registerHelper("mod", (str) => str.replace("D*", "D") );
        workflowVars = Object.assign(workflowVars, {
            workflow_id: `${workflowIdStub}_daily_deltas`,
            workflow_pattern: profile.daily.patterns.deltas,
            workflow_path: profile.daily.paths.deltas,
        });
        workflow = template(workflowVars);
        fs.writeFileSync(`${outDir}/${workflowIdStub}_daily_deltas.yaml`, workflow);



        /// history
        if(profile.history.paths) {
            workflowVars = Object.assign(workflowVars, {
                workflow_id: `${workflowIdStub}_history_full`,
                workflow_pattern: profile.history.patterns.full,
                workflow_path: profile.history.paths.full,
                pipelines: historyPipelines,
            });        

            console.log("Exporting history full");
            Handlebars.registerHelper("mod", (str) => str.replace("D*", "") );
            workflow = template(workflowVars);
            fs.writeFileSync(`${outDir}/${workflowIdStub}_history_full.yaml`, workflow);

            workflowVars = Object.assign(workflowVars, {
                workflow_id: `${workflowIdStub}_history_deltas`,
                workflow_pattern: profile.history.patterns.deltas,
                workflow_path: profile.history.paths.deltas,
            });        

            console.log("Exporting history deltas");
            Handlebars.registerHelper("mod", (str) => str.replace("D*", "D") );
            workflow = template(workflowVars);
            fs.writeFileSync(`${outDir}/${workflowIdStub}_history_deltas.yaml`, workflow);
        }
        else {
            console.log("Dataset does not have history");
        }
        
        console.log("File complete");
    }

    console.log("~Processing complete~");
    //console.log(types.filter((value, index, self) => self.indexOf(value) === index));
    //console.log(special.filter((value, index, self) => self.indexOf(value) === index));
});