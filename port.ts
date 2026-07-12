export function getPort(): number {
    const parsedPort = Number(process.env.PORT || "3000");

    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
        return 3000;
    }

    return parsedPort;
}
