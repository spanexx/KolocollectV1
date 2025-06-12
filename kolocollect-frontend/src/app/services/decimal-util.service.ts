/**
 * MongoDB Decimal Utility Service
 * Handles conversion of MongoDB Decimal128 values to Angular-friendly formats
 */

import { Injectable } from '@angular/core';

export interface NumberDecimalValue {
  $numberDecimal: string;
}

@Injectable({
  providedIn: 'root'
})
export class DecimalUtilService {

  /**
   * Converts MongoDB NumberDecimal to a regular number
   * @param decimal - MongoDB NumberDecimal object or number
   * @param defaultValue - Default value if conversion fails
   * @returns Converted number
   */
  toNumber(decimal: NumberDecimalValue | number | string | undefined | null, defaultValue: number = 0): number {
    if (decimal === null || decimal === undefined) {
      return defaultValue;
    }

    // If it's already a number, return it
    if (typeof decimal === 'number') {
      return decimal;
    }

    // If it's a string, try to parse it
    if (typeof decimal === 'string') {
      const parsed = parseFloat(decimal);
      return isNaN(parsed) ? defaultValue : parsed;
    }

    // If it's a MongoDB NumberDecimal object
    if (decimal && typeof decimal === 'object' && '$numberDecimal' in decimal) {
      const parsed = parseFloat(decimal.$numberDecimal);
      return isNaN(parsed) ? defaultValue : parsed;
    }

    return defaultValue;
  }

  /**
   * Converts MongoDB NumberDecimal to a formatted currency string
   * @param decimal - MongoDB NumberDecimal object or number
   * @param currency - Currency symbol (default: '$')
   * @param defaultValue - Default value if conversion fails
   * @returns Formatted currency string
   */
  toCurrency(decimal: NumberDecimalValue | number | string | undefined | null, currency: string = '$', defaultValue: number = 0): string {
    const num = this.toNumber(decimal, defaultValue);
    return `${currency}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Converts MongoDB NumberDecimal to a formatted number string
   * @param decimal - MongoDB NumberDecimal object or number
   * @param decimals - Number of decimal places
   * @param defaultValue - Default value if conversion fails
   * @returns Formatted number string
   */
  toFormattedNumber(decimal: NumberDecimalValue | number | string | undefined | null, decimals: number = 2, defaultValue: number = 0): string {
    const num = this.toNumber(decimal, defaultValue);
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  /**
   * Safely gets a nested property value
   * @param obj - Object to get property from
   * @param path - Dot-separated path to property
   * @param defaultValue - Default value if property doesn't exist
   * @returns Property value or default
   */
  safeGet<T>(obj: any, path: string, defaultValue: T): T {
    if (!obj) return defaultValue;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  /**
   * Checks if a MongoDB NumberDecimal value exists and is valid
   * @param decimal - MongoDB NumberDecimal object
   * @returns true if valid, false otherwise
   */
  isValidDecimal(decimal: NumberDecimalValue | number | string | undefined | null): boolean {
    if (decimal === null || decimal === undefined) {
      return false;
    }

    if (typeof decimal === 'number') {
      return !isNaN(decimal);
    }

    if (typeof decimal === 'string') {
      return !isNaN(parseFloat(decimal));
    }

    if (decimal && typeof decimal === 'object' && '$numberDecimal' in decimal) {
      return !isNaN(parseFloat(decimal.$numberDecimal));
    }

    return false;
  }

  /**
   * Adds two MongoDB NumberDecimal values
   * @param a - First value
   * @param b - Second value
   * @returns Sum as number
   */
  add(a: NumberDecimalValue | number | string | undefined | null, b: NumberDecimalValue | number | string | undefined | null): number {
    return this.toNumber(a) + this.toNumber(b);
  }

  /**
   * Subtracts two MongoDB NumberDecimal values
   * @param a - First value (minuend)
   * @param b - Second value (subtrahend)
   * @returns Difference as number
   */
  subtract(a: NumberDecimalValue | number | string | undefined | null, b: NumberDecimalValue | number | string | undefined | null): number {
    return this.toNumber(a) - this.toNumber(b);
  }

  /**
   * Multiplies two MongoDB NumberDecimal values
   * @param a - First value
   * @param b - Second value
   * @returns Product as number
   */
  multiply(a: NumberDecimalValue | number | string | undefined | null, b: NumberDecimalValue | number | string | undefined | null): number {
    return this.toNumber(a) * this.toNumber(b);
  }

  /**
   * Divides two MongoDB NumberDecimal values
   * @param a - Dividend
   * @param b - Divisor
   * @returns Quotient as number (returns 0 if divisor is 0)
   */
  divide(a: NumberDecimalValue | number | string | undefined | null, b: NumberDecimalValue | number | string | undefined | null): number {
    const divisor = this.toNumber(b);
    if (divisor === 0) return 0;
    return this.toNumber(a) / divisor;
  }

  /**
   * Calculates percentage
   * @param value - Value to calculate percentage of
   * @param total - Total value
   * @returns Percentage as number
   */
  toPercentage(value: NumberDecimalValue | number | string | undefined | null, total: NumberDecimalValue | number | string | undefined | null): number {
    const totalNum = this.toNumber(total);
    if (totalNum === 0) return 0;
    return (this.toNumber(value) / totalNum) * 100;
  }

  /**
   * Formats a percentage value
   * @param value - Value to calculate percentage of
   * @param total - Total value
   * @param decimals - Number of decimal places
   * @returns Formatted percentage string
   */
  toFormattedPercentage(value: NumberDecimalValue | number | string | undefined | null, total: NumberDecimalValue | number | string | undefined | null, decimals: number = 1): string {
    const percentage = this.toPercentage(value, total);
    return `${percentage.toFixed(decimals)}%`;
  }
}
