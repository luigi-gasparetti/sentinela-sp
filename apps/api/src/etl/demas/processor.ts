import type { Doenca, RegistroBruto } from "./types.ts";
import { normalizarData, normalizarNotificacao } from "./normalizers.ts";
import {
    validarNotificacao,
    type ProblemaValidacao,
} from "./validators.ts";

export interface ResultadoProcessamento {
    notificacao: ReturnType<typeof normalizarNotificacao>;
    problemas: ProblemaValidacao[];
}

/**
 * Normaliza e valida um registro bruto do DEMAS.
 *
 * A notificação é preservada mesmo quando apresenta problemas.
 */
export function processarNotificacao(
    registro: RegistroBruto,
    doenca: Doenca,
    dataReferencia: string,
): ResultadoProcessamento {
    if (normalizarData(dataReferencia) === null) {
        throw new RangeError(`Data de referência inválida: ${dataReferencia}`);
    }

    const notificacao = normalizarNotificacao(registro, doenca);

    const problemas = validarNotificacao(
        registro,
        notificacao,
        dataReferencia,
    );

    return { notificacao, problemas };
}