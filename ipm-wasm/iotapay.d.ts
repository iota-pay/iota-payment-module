/* tslint:disable */
/* eslint-disable */
/**
* @param {string} seed 
* @param {number} index 
* @param {number} security 
* @param {boolean} checksum 
* @returns {string} 
*/
export function generate_address(seed: string, index: number, security: number, checksum: boolean): string;
/**
* @param {string} seed 
* @param {number} startindex 
* @param {number} endindex 
* @param {number} security 
* @param {boolean} checksum 
* @returns {Array<any>} 
*/
export function generate_addresses(seed: string, startindex: number, endindex: number, security: number, checksum: boolean): Array<any>;
