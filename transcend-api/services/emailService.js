"use strict";
// Shim: services/* imported './emailService', but the implementation lives in
// src/services/emailService.ts. Re-exported rather than duplicated so there is
// one email path.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailNotification = exports.default = void 0;
__exportStar(require("../src/services/emailService"), exports);
var emailService_1 = require("../src/services/emailService");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return __importDefault(emailService_1).default; } });
const emailService_2 = require("../src/services/emailService");
/**
 * `sendEmailNotification(to, subject, body)`.
 *
 * Call sites pass an explicit subject and body, not a template key, so this
 * maps to sendRawEmail rather than the template-driven sendEmail.
 */
exports.sendEmailNotification = emailService_2.sendRawEmail;
