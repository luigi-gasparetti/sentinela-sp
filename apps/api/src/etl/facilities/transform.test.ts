import { describe, expect, it } from 'vitest';
import { facilityFromUbs, selectCurrentHospitals } from './transform.ts';

// Registros no formato devolvido pela API DEMAS (nov/2026).
const ubs = {
  ibge: '355030',
  bairro: 'GUAIANASES',
  logradouro: 'RUA CHUVAS DE VERAO',
  cnes: '2789310',
  uf: '35',
  latitude: '-23,56096',
  longitude: '-46,42381',
  nome: 'UBS VILA COSMOPOLITA',
};

function hospitalRow(overrides: Record<string, unknown> = {}) {
  return {
    unidade_da_federacao_onde_fica_o_hospital: 'SP',
    nome_do_municipio_onde_fica_o_hospital: 'SAO PAULO',
    nome_do_hospital: 'HOSPITAL MUNICIPAL TESTE',
    enderco_do_hospital: 'RUA TESTE',
    numero_do_endereco_do_hospital: '100',
    complemento_do_endereco_do_hospital: null,
    nome_do_bairro_do_endereco_do_hosptial: 'CENTRO',
    numero_do_cep_do_hospital: '01001000',
    quantidade_total_de_leitos_do_hosptial: 100.0,
    quantidade_total_de_leitos_sus_do_hosptial: 80.0,
    quantidade_de_leitos_de_uti_do_hosptial: 10.0,
    quantidade_de_leitos_de_uti_sus_do_hosptial: 8.0,
    codigo_ibge_do_municipio: '355030',
    ...overrides,
  };
}

describe('facilityFromUbs', () => {
  it('converte uma UBS do município', () => {
    expect(facilityFromUbs(ubs)).toEqual({
      cnes: '2789310',
      type: 'primary_care',
      name: 'UBS VILA COSMOPOLITA',
      stateCode: 'SP',
      municipalityCode: '355030',
      municipalityName: 'São Paulo',
      neighborhood: 'GUAIANASES',
      street: 'RUA CHUVAS DE VERAO',
      latitude: '-23.560960',
      longitude: '-46.423810',
    });
  });

  it('ignora UBS de outros municípios', () => {
    expect(facilityFromUbs({ ...ubs, ibge: '260290' })).toBeNull();
  });

  it('ignora UBS sem CNES válido', () => {
    expect(facilityFromUbs({ ...ubs, cnes: null })).toBeNull();
    expect(facilityFromUbs({ ...ubs, cnes: 'nan' })).toBeNull();
    expect(facilityFromUbs({ ...ubs, cnes: '12345678' })).toBeNull();
  });

  it('completa o CNES com zeros à esquerda', () => {
    expect(facilityFromUbs({ ...ubs, cnes: '302' })?.cnes).toBe('0000302');
  });

  it('descarta coordenadas ausentes ou fora do município', () => {
    for (const coords of [
      { latitude: null, longitude: null },
      { latitude: 'nan', longitude: '-46,4' },
      { latitude: '-22,62794', longitude: '-47,17668' },
    ]) {
      const facility = facilityFromUbs({ ...ubs, ...coords });
      expect(facility).toMatchObject({ latitude: null, longitude: null });
    }
  });

  it('normaliza textos vazios e espaços extras', () => {
    const facility = facilityFromUbs({ ...ubs, bairro: '  ', logradouro: ' RUA  A ' });
    expect(facility).toMatchObject({ neighborhood: null, street: 'RUA A' });
  });
});

describe('selectCurrentHospitals', () => {
  it('usa a última linha recente de cada hospital', () => {
    const rows = [
      hospitalRow({ codigo_ibge_do_municipio: null, quantidade_total_de_leitos_do_hosptial: 50 }),
      hospitalRow({ quantidade_total_de_leitos_do_hosptial: 90 }),
      hospitalRow({ quantidade_total_de_leitos_do_hosptial: 100 }),
    ];

    const result = selectCurrentHospitals(rows);

    expect(result).toHaveLength(1);
    expect(result[0]?.capacity).toEqual({
      generalBedsTotal: 100,
      generalBedsSus: 80,
      intensiveCareBedsTotal: 10,
      intensiveCareBedsSus: 8,
    });
  });

  it('deixa de fora hospitais que só aparecem em períodos antigos', () => {
    const rows = [
      hospitalRow({ nome_do_hospital: 'HOSPITAL FECHADO', codigo_ibge_do_municipio: null }),
      hospitalRow(),
    ];

    expect(selectCurrentHospitals(rows).map((h) => h.facility.name)).toEqual([
      'HOSPITAL MUNICIPAL TESTE',
    ]);
  });

  it('ignora hospitais de outros municípios', () => {
    const rows = [
      hospitalRow({
        nome_do_municipio_onde_fica_o_hospital: 'OSASCO',
        codigo_ibge_do_municipio: '353440',
      }),
    ];
    expect(selectCurrentHospitals(rows)).toEqual([]);
  });

  it('separa hospitais de mesmo nome em endereços diferentes', () => {
    const rows = [hospitalRow(), hospitalRow({ numero_do_endereco_do_hospital: '200' })];
    expect(selectCurrentHospitals(rows)).toHaveLength(2);
  });

  it('monta o endereço e valida o CEP', () => {
    const [valid] = selectCurrentHospitals([hospitalRow()]);
    expect(valid?.facility).toMatchObject({
      cnes: null,
      type: 'hospital',
      street: 'RUA TESTE',
      streetNumber: '100',
      neighborhood: 'CENTRO',
      postalCode: '01001000',
    });

    const [invalid] = selectCurrentHospitals([hospitalRow({ numero_do_cep_do_hospital: '123' })]);
    expect(invalid?.facility.postalCode).toBeNull();
  });

  it('trata leitos ausentes ou inválidos como nulos', () => {
    const [hospital] = selectCurrentHospitals([
      hospitalRow({
        quantidade_total_de_leitos_do_hosptial: null,
        quantidade_de_leitos_de_uti_do_hosptial: 'nan',
        quantidade_de_leitos_de_uti_sus_do_hosptial: -1,
      }),
    ]);
    expect(hospital?.capacity).toMatchObject({
      generalBedsTotal: null,
      intensiveCareBedsTotal: null,
      intensiveCareBedsSus: null,
    });
  });
});
