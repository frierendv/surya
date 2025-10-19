import * as fs from "fs";
import * as path from "path";

interface PackageDependencies {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

const getPackage = ({ url }: { url: string }) => {
	const packageJsonPath = path.join(url, "package.json");
	if (fs.existsSync(packageJsonPath)) {
		return JSON.parse(
			fs.readFileSync(packageJsonPath, "utf-8")
		) as PackageDependencies;
	}
	return undefined;
};

function getPackages(dir: string) {
	const packagesDirs = fs.readdirSync(dir).filter((file) => {
		return fs.statSync(path.join(dir, file)).isDirectory();
	});
	const packages: PackageDependencies[] = [];
	for (const subDir of packagesDirs) {
		const packageJsonPath = path.join(dir, subDir);
		const p = getPackage({ url: packageJsonPath });
		if (p) {
			packages.push(p);
		}
	}
	return packages;
}

export const getConfigs = ({
	packageUrl,
	packagesUrl,
}: {
	packageUrl: string;
	packagesUrl: string;
}) => {
	const p = getPackage({ url: packageUrl });
	if (p) {
		const packages = getPackages(packagesUrl);
		const packageNames = packages.map((p) => p.name);

		const findexternal = (currentPackage: PackageDependencies) => {
			let externals: string[] = [];
			if (currentPackage.dependencies) {
				const currentPackageNames = [
					...Object.keys(currentPackage.dependencies || {}),
					...Object.keys(currentPackage.devDependencies || {}),
				];
				for (const name of currentPackageNames) {
					if (packageNames.includes(name)) {
						const p = packages.find((p) => p.name === name);
						console.log(name);
						externals = [...externals, ...findexternal(p!)];
					} else {
						externals.push(name);
					}
				}
			}
			return externals;
		};

		const findNoExternal = (currentPackage: PackageDependencies) => {
			let noExternals: string[] = [];
			if (currentPackage.dependencies) {
				const currentPackageNames = [
					...Object.keys(currentPackage.dependencies || {}),
					...Object.keys(currentPackage.devDependencies || {}),
				];
				for (const name of currentPackageNames) {
					if (packageNames.includes(name)) {
						const p = packages.find((p) => p.name === name);
						noExternals.push(name);
						noExternals = [...noExternals, ...findNoExternal(p!)];
					}
				}
			}
			return noExternals;
		};

		return {
			external: findexternal(p),
			noExternal: findNoExternal(p),
		};
	}
};
