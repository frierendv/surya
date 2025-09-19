import { parsePhoneNumberFromString } from "libphonenumber-js";
import type {
	CountryCallingCode,
	CountryCode,
	E164Number,
	NationalNumber,
} from "libphonenumber-js";

export interface IPhoneDetail {
	/**
	 * E.164 formatted number (e.g. +1234567890)
	 */
	number: E164Number;
	/**
	 * ISO 3166-1 alpha-2 country code (e.g. US, IN, GB)
	 */
	country: CountryCode;
	/**
	 * Country calling code (e.g. 1 for US, 91 for IN)
	 */
	countryCallingCode: CountryCallingCode;
	/**
	 * National number (e.g. 234567890 for +1234567890)
	 */
	nationalNumber: NationalNumber;
	/**
	 * Full phone number detail from libphonenumber-js
	 */
	detail?: ReturnType<typeof parsePhoneNumberFromString>;
}

export const getPhoneDetail = (raw: string): IPhoneDetail => {
	const input = raw.startsWith("+") ? raw : `+${raw}`;
	const pn = parsePhoneNumberFromString(input);

	/**
	 * As per libphonenumber-js docs, parsePhoneNumberFromString
	 * returns undefined if the number is invalid
	 */
	if (!pn?.isValid()) {
		console.warn(`Invalid phone number: ${raw}`);
		return {} as IPhoneDetail;
	}
	const number = pn?.number as E164Number;
	const country = pn?.country as CountryCode;
	const countryCallingCode = pn?.countryCallingCode as CountryCallingCode;
	const nationalNumber = pn?.nationalNumber as NationalNumber;

	return {
		number,
		country,
		countryCallingCode,
		nationalNumber,
	};
};
