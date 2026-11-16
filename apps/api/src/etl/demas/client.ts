
import type { Doenca, RegistroBruto } from "./types.ts";

const URL_BASE = "https://apidadosabertos.saude.gov.br/arboviroses";

const ENDPOINTS: Record<Doenca, string> = {
	dengue: "dengue",
	chikungunya: "chikungunya",
	zika: "zikavirus",
};

const LIMITE_MAXIMO = 1000;

export interface OpcoesConsulta {
	municipioNotificacao: string;
	limitePagina?: number;
}

function extrairRegistros(
	payload: unknown,
	doenca: Doenca,
): RegistroBruto[] {
	if (
		typeof payload !== "object" ||
		payload === null ||
		Array.isArray(payload)
	) {
		throw new Error("Resposta inválida da API do DEMAS.");
	}

	const registros = (payload as Record<string, unknown>)[doenca === "zika" ? "zikavirus" : doenca];

	if (!Array.isArray(registros)) {
		throw new Error(
			`A resposta da API não contém uma lista válida de registros para ${doenca}.`,
		);
	}

	return registros.map((registro, indice) => {
		if (
			typeof registro !== "object" ||
			registro === null ||
			Array.isArray(registro)
		) {
			throw new Error(`Registro inválido na posição ${indice}.`);
		}

		return registro as RegistroBruto;
	});
}

export async function* iterarNotificacoes(
	doenca: Doenca,
	opcoes: OpcoesConsulta,
	fetcher: typeof fetch = fetch,
): AsyncGenerator<RegistroBruto> {
	const limite = opcoes.limitePagina ?? LIMITE_MAXIMO;

	if (
		!Number.isInteger(limite) ||
		limite < 1 ||
		limite > LIMITE_MAXIMO
	) {
		throw new RangeError(
			`O limite por página deve ser um inteiro entre 1 e ${LIMITE_MAXIMO}.`,
		);
	}

	if (!/^\d+$/.test(opcoes.municipioNotificacao)) {
		throw new RangeError("Código de município inválido.");
	}

	let offset = 0;

	while (true) {
		const url = new URL(`${URL_BASE}/${ENDPOINTS[doenca]}`);

		url.searchParams.set("id_municip", opcoes.municipioNotificacao);
		url.searchParams.set("limit", String(limite));
		url.searchParams.set("offset", String(offset));

		const resposta = await fetcher(url);

		if (!resposta.ok) {
			throw new Error(
				`Erro ao consultar o DEMAS: HTTP ${resposta.status} (${resposta.statusText}).`,
			);
		}

		const payload: unknown = await resposta.json();
		const registros = extrairRegistros(payload, doenca);

		for (const registro of registros) {
			yield registro;
		}

		if (registros.length < limite) {
			break;
		}

		offset++;
	}
}
