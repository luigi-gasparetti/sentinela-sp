
import { describe, expect, it } from "vitest";
import { normalizarNotificacao } from "./normalizers.ts";
import { agregarCasosPorSemana, agregarCasosPorSemanaEUnidade } from "./aggregates.ts";
import type { Doenca } from "./types.ts";
import type { ResultadoProcessamento } from "./processor.ts";

function criarResultado(
	doenca: Doenca,
	registro: Record<string, unknown> = {},
): ResultadoProcessamento {
	return {
		notificacao: normalizarNotificacao(registro, doenca),
		problemas: [],
	};
}

async function* fluxo(
	...resultados: ResultadoProcessamento[]
): AsyncGenerator<ResultadoProcessamento> {
	for (const resultado of resultados) {
		yield resultado;
	}
}

describe("agregarCasosPorSemana", () => {
	it("agrupa notificações por doença, ano e semana", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "11",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202602",
				classi_fin: "10",
			}),
			criarResultado("chikungunya", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "13",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([
			{
				doenca: "chikungunya",
				ano: 2026,
				semana: 1,
				total: 1,
			},
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				total: 2,
			},
			{
				doenca: "dengue",
				ano: 2026,
				semana: 2,
				total: 1,
			},
		]);
	});

	it("inclui classificações ausentes e desconhecidas", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "99",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				total: 2,
			},
		]);
	});

	it("inclui classificações inconclusivas e não descartadas", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "8",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				total: 1,
			},
		]);
	});

	it.each([
		["dengue", "5"],
		["chikungunya", "5"],
		["zika", "2"],
	] as const)(
		"exclui notificações explicitamente descartadas de %s",
		async (doenca, codigo) => {
			const resultados = fluxo(
				criarResultado(doenca, {
					id_municip: "355030",
					sem_pri: "202601",
					classi_fin: codigo,
				}),
			);

			await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([]);
		},
	);

	it("ignora notificações sem semana de início dos sintomas", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				classi_fin: "10",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([]);
	});

	it("não utiliza a semana de notificação como substituta", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				sem_not: "202601",
				classi_fin: "10",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([]);
	});

	it("considera somente notificações do município de São Paulo", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "350950",
				sem_pri: "202601",
				classi_fin: "10",
			}),
		);

		await expect(agregarCasosPorSemana(resultados)).resolves.toEqual([
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				total: 1,
			},
		]);
	});
});

describe("agregarCasosPorSemanaEUnidade", () => {
	it("agrupa notificações por doença, semana e unidade de saúde", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202601",
				classi_fin: "11",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "7654321",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202602",
				classi_fin: "10",
			}),
		);

		await expect(
			agregarCasosPorSemanaEUnidade(resultados),
		).resolves.toEqual([
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				cnes: "1234567",
				total: 2,
			},
			{
				doenca: "dengue",
				ano: 2026,
				semana: 1,
				cnes: "7654321",
				total: 1,
			},
			{
				doenca: "dengue",
				ano: 2026,
				semana: 2,
				cnes: "1234567",
				total: 1,
			},
		]);
	});

	it("mantém notificações sem CNES em um grupo separado", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				sem_pri: "202601",
				classi_fin: "10",
			}),
		);

		await expect(
            agregarCasosPorSemanaEUnidade(resultados),
        ).resolves.toEqual([
            {
                doenca: "dengue",
                ano: 2026,
                semana: 1,
                cnes: null,
                total: 2,
            },
            {
                doenca: "dengue",
                ano: 2026,
                semana: 1,
                cnes: "1234567",
                total: 1,
            },
        ]);
	});

	it("não mistura unidades, doenças ou semanas diferentes", async () => {
		const resultados = fluxo(
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202601",
				classi_fin: "10",
			}),
			criarResultado("chikungunya", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202601",
				classi_fin: "13",
			}),
			criarResultado("dengue", {
				id_municip: "355030",
				id_unidade: "1234567",
				sem_pri: "202602",
				classi_fin: "10",
			}),
		);

		const agregados = await agregarCasosPorSemanaEUnidade(resultados);

		expect(agregados).toHaveLength(3);
		expect(agregados.every((item) => item.total === 1)).toBe(true);
	});
});
