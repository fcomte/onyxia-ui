import React from "react";
import { Tabs, Tab } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import { AppBar, Chip, Button } from "@material-ui/core/";
import queryString from "query-params";
import { Redirect } from "react-router-dom";
import Formulaire from "./formulaire";
import { getAvatar } from "js/utils";
import { getMinioToken } from "js/minio-client";
import FilDAriane, { fil } from "js/components/commons/fil-d-ariane";
import { getDefaultSingleOption } from "js/universe/universeContractFiller";
import "./nouveau-service.scss";
import IconButton from "@material-ui/core/IconButton";
import VisibilityIcon from "@material-ui/icons/Visibility";
import JSONEditor from "js/components/commons/json-editor/index";
import { getVaultToken } from "js/vault-client";
class NouveauService extends React.Component {
  state = {
    redirect: false,
    onglet: 0,
    fieldsValues: {},
    ongletFields: [],
    minioCredentials: undefined,
    state: {},
    contract: undefined
  };
  constructor(props) {
    super(props);
    this.state.queryParams = queryString.decode(getCleanParams());

    if (!props.service) {
      props.chargerService(props.match.params.idService);
    }
  }

  componentDidMount() {
    getVaultToken();
    getMinioToken()
      .then(minioCredentials => {
        this.setState({ minioCredentials });
        this.clickIfAutomode();
      })
      .catch(e => {
        this.setState({ minioCredentials: {} });
        this.clickIfAutomode();
      });
  }

  clickIfAutomode() {
    if (this.state.queryParams.auto) {
      this.handleClickCreer(false);
    }
  }

  static getDerivedStateFromProps(props, state) {
    if (
      props.service !== null &&
      state.ongletFields.length === 0 &&
      state.minioCredentials
    ) {
      const onglets = props.service ? props.service.properties : {};
      const user = props.user ? props.user : {};
      const ongletFields = getOnglets(onglets);
      const fieldsValues = ongletFields
        .map(onglet => onglet.fields)
        .reduce(
          (acc, curr) => ({
            ...acc,
            ...arrayToObject(state.minioCredentials)(state.queryParams)(user)(
              curr
            )
          }),
          {}
        );
      return { ...state, fieldsValues, ongletFields };
    }
    return state;
  }

  handlechangeField = path => value => {
    this.setState({
      fieldsValues: { ...this.state.fieldsValues, [path]: value }
    });
  };

  handleChangeOnglet = (e, onglet) => this.setState({ onglet });

  handleClickCreer = (preview = false) => {
    this.props
      .creerNouveauService(
        {
          ...this.props.service,
          catalogId: this.props.idCatalogue
        },
        getValuesObject(this.state.fieldsValues),
        preview
      )
      .then(response => {
        if (preview) {
          this.setState({ contract: response });
        } else {
          this.setState({ redirect: true });
        }
      });

    return false;
  };

  render() {
    const { service, idCatalogue, idService } = this.props;
    const { contract } = this.state;
    if (!service) return null;
    if (this.state.redirect) return <Redirect to="/my-lab/mes-services" />;
    if (!service || this.state.ongletFields.length === 0) return null;
    const onglet = this.state.ongletFields[this.state.onglet] || {};
    const user = this.props.user ? this.props.user : {};
    return (
      <React.Fragment>
        <div className="en-tete en-tete-service">
          <Typography
            variant="h2"
            align="center"
            color="textPrimary"
            gutterBottom
          >
            Créez votre propre service
          </Typography>
          <div className="service">
            <div className="titre">
              <Chip avatar={getAvatar(service)} label={service.name} />
            </div>
          </div>
        </div>
        <FilDAriane fil={fil.nouveauService(idCatalogue, idService)} />
        <div className="contenu nouveau-service">
          <AppBar position="static">
            <Tabs
              value={this.state.onglet}
              onChange={this.handleChangeOnglet}
              variant="scrollable"
              scrollButtons="on"
            >
              {mapServiceToOnglets(this.state.ongletFields)}
            </Tabs>
          </AppBar>

          <div className="description">
            <Typography
              variant="button"
              align="center"
              color="textPrimary"
              gutterBottom
            >
              {onglet.description}
            </Typography>
          </div>

          <Formulaire
            user={user}
            name={onglet.nom}
            handleChange={this.handlechangeField}
            fields={onglet.fields}
            values={this.state.fieldsValues}
          />

          <div className="actions">
            <Button
              id="bouton-creer-nouveau-service"
              variant="contained"
              color="primary"
              onClick={() => this.handleClickCreer(false)}
            >
              Créer votre service
            </Button>
            <IconButton
              id="bouton-preview-nouveau-service"
              variant="contained"
              color="primary"
              onClick={() => this.handleClickCreer(true)}
            >
              <VisibilityIcon>Preview</VisibilityIcon>
            </IconButton>
            {contract ? <JSONEditor json={contract} readOnly={true} /> : <></>}
          </div>
        </div>
      </React.Fragment>
    );
  }
}

const getOnglets = onglets =>
  Object.entries(onglets)
    .map(([nom, onglet]) => mapOngletToFields(nom)(onglet))
    .filter(o => o.fields.length > 0);

const mapOngletToFields = nom => onglet => ({
  nom: nom,
  description:
    onglet.description || "Cet onglet ne possède pas de description.",
  fields: getFields(nom)(onglet).filter(
    ({ field }) => field["js-control"] !== "shadow"
  )
});

const getFields = nom => onglet => {
  const fields = [];
  Object.entries(onglet).forEach(([key, entry]) => {
    const { type, properties, enum: options, title } = entry;
    switch (type) {
      case "boolean":
      case "number":
      case "string":
        fields.push({
          path: `${nom}.${key}`,
          field: {
            ...entry,
            type: options && options.length > 0 ? "select" : type,
            nom: title || key,
            options
          }
        });
        break;
      case "object":
        fields.push(...getFields(`${nom}.${key}`)(properties));
        break;
      default:
        break;
    }
  });

  return fields;
};

const arrayToObject = minioCredentials => queryParams => user => fields => {
  const obj = {};
  const fromParams = getFromQueryParams(queryParams);
  fields.forEach(
    ({ path, field }) =>
      (obj[path] = fromParams(path)(field) || getDefaultSingleOption(field))
  );
  return obj;
};

const getCleanParams = () =>
  window.location.search.startsWith("?")
    ? window.location.search.substring(1, window.location.search.length)
    : window.location.search;

const getFromQueryParams = queryParams => path => ({
  "js-control": jsControl,
  type
}) => {
  if (jsControl === "ro") {
    return undefined;
  }
  return path in queryParams
    ? type === "boolean"
      ? queryParams[path] === "true"
      : queryParams[path]
    : undefined;
};

const mapServiceToOnglets = ongletFields =>
  ongletFields.map(({ nom }, i) => <Tab key={i} label={nom} />);

/*
 * Fonctions permettant de remettre en forme les valeurs
 * de champs comme attendu par l'api.
 */
const getValuesObject = fieldsValues =>
  Object.entries(fieldsValues)
    .map(([key, value]) => ({
      path: key.split("."),
      value
    }))
    .reduce((acc, curr) => ({ ...acc, ...getPathValue(curr)(acc) }), {});

const getPathValue = ({ path: [first, ...rest], value }) => (other = {}) => {
  if (rest.length === 0) {
    return { [first]: value, ...other };
  }
  return {
    ...other,
    [first]: getPathValue({ path: rest, value })(other[first])
  };
};

export default NouveauService;
