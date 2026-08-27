//#region node_modules/.nitro/vite/services/ssr/assets/solar-data-CBLxIq3U.js
/**
* The eight, in order from the sun.
*
* Colours are the standard reference appearance for each body: Mercury
* grey-brown, Venus pale yellow-white, Earth blue and green under white cloud,
* Mars rust, Jupiter banded tan and orange, Saturn pale gold, Uranus pale cyan,
* Neptune deep blue.
*/
var PLANETS = [
	{
		id: "mercury",
		name: "Mercury",
		radius: .38,
		orbit: 9,
		speed: .196,
		phase: .4,
		spin: .09,
		color: 9207669,
		accent: 5984329,
		glow: 10259840,
		glowStrength: .22,
		inclination: .06
	},
	{
		id: "venus",
		name: "Venus",
		radius: .72,
		orbit: 12.4,
		speed: .145,
		phase: 2.1,
		spin: -.04,
		color: 15259043,
		accent: 13215850,
		glow: 15983546,
		glowStrength: .34,
		inclination: -.04
	},
	{
		id: "earth",
		name: "Earth",
		radius: .78,
		orbit: 16.2,
		speed: .118,
		phase: 3.6,
		spin: .22,
		color: 3108789,
		accent: 4165450,
		glow: 7320831,
		glowStrength: .4,
		inclination: .03
	},
	{
		id: "mars",
		name: "Mars",
		radius: .52,
		orbit: 20.1,
		speed: .096,
		phase: 5.2,
		spin: .2,
		color: 11817261,
		accent: 8205856,
		glow: 14182975,
		glowStrength: .27,
		inclination: -.07
	},
	{
		id: "jupiter",
		name: "Jupiter",
		radius: 2.35,
		orbit: 27.5,
		speed: .052,
		phase: 1.1,
		spin: .46,
		color: 13215874,
		accent: 9069124,
		glow: 14728851,
		glowStrength: .3,
		inclination: .02
	},
	{
		id: "saturn",
		name: "Saturn",
		radius: 1.95,
		orbit: 35.4,
		speed: .038,
		phase: 4.4,
		spin: .42,
		color: 14206093,
		accent: 11112540,
		glow: 15654316,
		glowStrength: .26,
		inclination: -.05
	},
	{
		id: "uranus",
		name: "Uranus",
		radius: 1.35,
		orbit: 44.2,
		speed: .027,
		phase: 2.8,
		spin: .3,
		color: 9427165,
		accent: 6269373,
		glow: 11137268,
		glowStrength: .36,
		inclination: .09
	},
	{
		id: "neptune",
		name: "Neptune",
		radius: 1.28,
		orbit: 52.6,
		speed: .021,
		phase: .9,
		spin: .31,
		color: 3101380,
		accent: 1913730,
		glow: 5930495,
		glowStrength: .38,
		inclination: -.03
	}
];
var SUN_RADIUS = 4.2;
var URANUS_MOONS = [
	{
		name: "Cordelia",
		km: 20,
		orbit: 2.2,
		speed: .62,
		phase: 0,
		inclination: .01
	},
	{
		name: "Ophelia",
		km: 21,
		orbit: 2.38,
		speed: .58,
		phase: .7,
		inclination: .02
	},
	{
		name: "Bianca",
		km: 26,
		orbit: 2.62,
		speed: .53,
		phase: 1.4,
		inclination: .01
	},
	{
		name: "Cressida",
		km: 40,
		orbit: 2.74,
		speed: .5,
		phase: 2.1,
		inclination: 0
	},
	{
		name: "Desdemona",
		km: 32,
		orbit: 2.84,
		speed: .48,
		phase: 2.8,
		inclination: .01
	},
	{
		name: "Juliet",
		km: 47,
		orbit: 2.98,
		speed: .46,
		phase: 3.5,
		inclination: .02
	},
	{
		name: "Portia",
		km: 68,
		orbit: 3.08,
		speed: .44,
		phase: 4.2,
		inclination: .01
	},
	{
		name: "Rosalind",
		km: 36,
		orbit: 3.3,
		speed: .41,
		phase: 4.9,
		inclination: .02
	},
	{
		name: "Cupid",
		km: 9,
		orbit: 3.44,
		speed: .39,
		phase: 5.6,
		inclination: .01
	},
	{
		name: "Belinda",
		km: 45,
		orbit: 3.56,
		speed: .38,
		phase: .3,
		inclination: 0
	},
	{
		name: "Perdita",
		km: 15,
		orbit: 3.66,
		speed: .37,
		phase: 1,
		inclination: .02
	},
	{
		name: "Puck",
		km: 81,
		orbit: 3.88,
		speed: .34,
		phase: 1.7,
		inclination: .01
	},
	{
		name: "Mab",
		km: 12,
		orbit: 4.06,
		speed: .32,
		phase: 2.4,
		inclination: .03
	},
	{
		name: "Miranda",
		km: 236,
		orbit: 4.5,
		speed: .28,
		phase: 3.1,
		inclination: .07
	},
	{
		name: "Ariel",
		km: 579,
		orbit: 5.2,
		speed: .24,
		phase: 3.8,
		inclination: .01
	},
	{
		name: "Umbriel",
		km: 585,
		orbit: 5.9,
		speed: .2,
		phase: 4.5,
		inclination: .02
	},
	{
		name: "Titania",
		km: 788,
		orbit: 6.9,
		speed: .16,
		phase: 5.2,
		inclination: .01
	},
	{
		name: "Oberon",
		km: 761,
		orbit: 7.7,
		speed: .14,
		phase: 5.9,
		inclination: .02
	},
	{
		name: "Francisco",
		km: 11,
		orbit: 8.6,
		speed: .11,
		phase: .6,
		inclination: .62
	},
	{
		name: "Caliban",
		km: 36,
		orbit: 9.2,
		speed: .1,
		phase: 1.3,
		inclination: .51
	},
	{
		name: "Stephano",
		km: 16,
		orbit: 9.7,
		speed: .094,
		phase: 2,
		inclination: .49
	},
	{
		name: "Trinculo",
		km: 9,
		orbit: 10.1,
		speed: .088,
		phase: 2.7,
		inclination: .58
	},
	{
		name: "Sycorax",
		km: 78,
		orbit: 10.7,
		speed: .081,
		phase: 3.4,
		inclination: .55
	},
	{
		name: "Margaret",
		km: 10,
		orbit: 11.2,
		speed: .076,
		phase: 4.1,
		inclination: .4
	},
	{
		name: "Prospero",
		km: 25,
		orbit: 11.7,
		speed: .071,
		phase: 4.8,
		inclination: .63
	},
	{
		name: "Setebos",
		km: 24,
		orbit: 12.2,
		speed: .067,
		phase: 5.5,
		inclination: .66
	},
	{
		name: "Ferdinand",
		km: 10,
		orbit: 12.7,
		speed: .063,
		phase: .2,
		inclination: .61
	},
	{
		name: "S/2023 U1",
		km: 4,
		orbit: 13.2,
		speed: .059,
		phase: .9,
		inclination: .57
	}
];
/** The smallest a moon may be drawn, in scene units. Below this it vanishes. */
var MOON_MIN_RADIUS = .028;
/** The largest — Titania. Everything else is proportional beneath it. */
var MOON_MAX_RADIUS = .15;
/**
* A moon's drawn radius from its real one.
*
* A CUBE ROOT, NOT A LINEAR MAP. Linear scaling of an 88:1 range puts almost
* every moon on the floor and makes the whole set look uniform — the exact
* information the real sizes were meant to carry is lost to the clamp. The cube
* root compresses the range while keeping the order strictly intact, so Titania
* still reads as far larger than Puck and Puck as larger than Cupid.
*/
function radiusFor(km) {
	const largest = Math.max(...URANUS_MOONS.map((m) => m.km));
	return MOON_MIN_RADIUS + Math.cbrt(Math.max(0, km) / largest) * (MOON_MAX_RADIUS - MOON_MIN_RADIUS);
}
//#endregion
export { radiusFor as i, SUN_RADIUS as n, URANUS_MOONS as r, PLANETS as t };
