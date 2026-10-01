const LPP = "ljubljanski potniški promet";
const SZ = "slovenske železnice";

export const isLppOperator = (name) =>
	typeof name === "string" && name.toLowerCase().includes(LPP);

export const isSzOperator = (name) => {
	if (typeof name !== "string") return false;
	const lower = name.toLowerCase();
	return lower.includes(SZ) || lower.includes("sž");
};

export const operatorDisplayName = (name) =>
	name === "MP_Kranj" ? "Mestni promet Kranj" : name;
