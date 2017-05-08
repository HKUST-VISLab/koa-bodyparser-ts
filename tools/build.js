const shelljs = require("shelljs");

const dist = "dist";
function cleanDist() {
    shelljs.rm("-rf", dist);
}

function move() {
    shelljs.mv(`${dist}/src/*`, dist);
    shelljs.mv(`${dist}/test/*`, dist);
    shelljs.rm("-rf", `${dist}/src`);
    shelljs.rm("-rf", `${dist}/test`);
}

switch (process.argv[2]) {
    case "clean":
        cleanDist();
        break;
    case "move":
        move();
        break;
    default:
        console.info("No command");
}