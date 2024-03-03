import { InternalServerError } from "elysia";
import jwt, { JwtPayload } from "jsonwebtoken";

export const authResolver = ({ bearer, set }: { bearer: string | undefined, set: any }): { jwtDecoded: jwt.JwtPayload; } => {
    let jwtDecoded: JwtPayload;

    jwt.verify(
        bearer!,
        atob(process.env.KEYCLOAK_OBELISK_PK!),
        (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
            if (err) {
                set.status = "Unauthorized";
                throw err.toString();
            }

            if (decoded) {
                jwtDecoded = decoded as JwtPayload;
            } else {
                throw new InternalServerError("Cannot decode JWT token");
            }
        }
    );

    return {
        jwtDecoded: jwtDecoded!
    };
}
