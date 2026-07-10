"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPDF = extractPDF;
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = require("pdf-parse");
async function extractPDF(filePath) {
    const buffer = fs_1.default.readFileSync(filePath);
    const parser = new pdf_parse_1.PDFParse({
        data: buffer
    });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
}
