/**
 * External dependencies
 */
import React from 'react';
// import classNames from 'classnames';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import filter from 'lodash/filter';

/**
 * Internal dependencies
 */
import Card from 'components/card';
import CompactCard from 'components/card/compact';
import FeatureExample from 'components/feature-example';
import Button from 'components/button';
import Notice from 'components/notice';
import PluginIcon from 'my-sites/plugins/plugin-icon/plugin-icon';
import PluginActivateToggle from 'my-sites/plugins/plugin-activate-toggle';
import PluginAutoupdateToggle from 'my-sites/plugins/plugin-autoupdate-toggle';
import JetpackManageErrorPage from 'my-sites/jetpack-manage-error-page';

// Redux actions & selectors
import { getSelectedSiteId } from 'state/ui/selectors';
import { getPlugin } from 'state/plugins/wporg/selectors';
import { fetchPluginData } from 'state/plugins/wporg/actions';
import {
	fetchInstallInstructions,
	installPlugin,
} from 'state/plugins/premium/actions';
import {
	getPluginsForSite,
	getActivePlugin,
	getNextPlugin,
	isFinished,
	isInstalling,
	isRequesting
} from 'state/plugins/premium/selectors';
// Store for existing plugins
import PluginsStore from 'lib/plugins/store';

const PlansSetup = React.createClass( {
	displayName: 'PlanSetup',

	doingText( slug ) {
		switch ( slug ) {
			case 'vaultpress':
				return this.translate( '{{b}}VaultPress{{/b}} is backing up your site', { components: { b: <strong /> } } );
			case 'akismet':
				return this.translate( '{{b}}Akismet{{/b}} is checking for spam', { components: { b: <strong /> } } );
			case 'polldaddy':
				return this.translate( '{{b}}Polldaddy{{/b}} doesn\'t have an active state?', { components: { b: <strong /> } } );
		}
		return null;
	},

	// plugins for Jetpack sites require additional data from the wporg-data store
	addWporgDataToPlugins( plugins ) {
		return plugins.map( plugin => {
			const pluginData = getPlugin( this.props.wporg, plugin.slug );
			if ( ! pluginData ) {
				this.props.fetchPluginData( plugin.slug );
			}
			return Object.assign( {}, plugin, pluginData );
		} );
	},

	allPluginsHaveWporgData() {
		const plugins = this.addWporgDataToPlugins( this.props.plugins );
		return ( plugins.length === filter( plugins, { wporg: true } ).length );
	},

	componentDidMount() {
		this.props.fetchInstallInstructions( this.props.siteId );
	},

	componentDidUpdate() {
		const site = this.props.selectedSite;
		if ( site.canManage() && this.allPluginsHaveWporgData() && ! this.props.isInstalling && this.props.nextPlugin ) {
			this.startNextPlugin( this.props.nextPlugin );
		}
	},

	startNextPlugin( plugin ) {
		let getPluginFromStore;
		let install = this.props.installPlugin;
		let site = this.props.selectedSite;

		// Merge wporg info into the plugin object
		plugin = Object.assign( {}, plugin, getPlugin( this.props.wporg, plugin.slug ) );

		getPluginFromStore = function() {
			let sitePlugin = PluginsStore.getSitePlugin( site, plugin.slug );
			if ( ! sitePlugin && PluginsStore.isFetchingSite( site ) ) {
				// if the Plugins are still being fetched, we wait. We are not using flux
				// store events because it would be more messy to handle the one-time-only
				// callback with bound parameters than to do it this way.
				return setTimeout( getPluginFromStore, 500 );
			}
			// Merge any site-specific info into the plugin object, setting a default plugin ID if needed
			plugin = Object.assign( { id: plugin.slug }, plugin, sitePlugin );
			install( plugin, site );
		};
		getPluginFromStore();
	},

	renderNoJetpackSiteSelected() {
		return (
			<JetpackManageErrorPage
				site={ this.props.selectedSite }
				title={ this.translate( 'Oh no! You need to select a jetpack site to be able to setup your plan' ) }
				illustration={ '/calypso/images/jetpack/jetpack-manage.svg' } />
		);
	},

	renderNoJetpackPlan() {
		return (
			<div>
				<h1 className="plan-setup__header">{ this.translate( 'Nothing to do here…' ) }</h1>
			</div>
		);
	},

	renderPlugins( hidden = false ) {
		const plugins = this.addWporgDataToPlugins( this.props.plugins );

		return plugins.map( ( item, i ) => {
			const plugin = Object.assign( {}, item, getPlugin( this.props.wporg, item.slug ) );

			const statusProps = {
				isCompact: true,
				status: 'is-info',
				showDismiss: false,
			};

			if ( plugin.error ) {
				statusProps.status = 'is-error';
				statusProps.text = plugin.error.message;
			} else if ( hidden ) {
				statusProps.icon = 'plugins';
				statusProps.status = null;
				statusProps.text = this.translate( 'Waiting to install' );
			} else {
				statusProps.icon = 'plugins';
				statusProps.status = 'is-info';
				switch ( plugin.status ) {
					case 'done':
						statusProps.status = 'is-success';
						statusProps.icon = null;
						statusProps.text = this.translate( 'Done', { args: { plugin: plugin.name } } );
						break;
					case 'activate':
					case 'configure':
						statusProps.text = this.translate( 'Almost done', { args: { plugin: plugin.name } } );
						break;
					case 'install':
						statusProps.text = this.translate( 'Working…', { args: { plugin: plugin.name } } );
					case 'wait':
					default:
						statusProps.text = this.translate( 'Waiting to install', { args: { plugin: plugin.name } } );
				}
			}

			return (
				<CompactCard className="plugin-item" key={ i }>
					<span className="plugin-item__link">
						<PluginIcon image={ plugin.icon } />
						<div className="plugin-item__title">
							{ plugin.name }
						</div>
						<Notice { ...statusProps } />
					</span>
				</CompactCard>
			);
		} );
	},

	renderActions( item, plugin ) {
		return (
			<div className="plugin-item__actions">
				<PluginActivateToggle
					plugin={ plugin }
					disabled={ true }
					site={ this.props.selectedSite } />
				<PluginAutoupdateToggle
					plugin={ plugin }
					disabled={ true }
					site={ this.props.selectedSite }
					wporg={ !! plugin.wporg } />
			</div>
		);
	},

	render() {
		const site = this.props.selectedSite;
		if ( ! site || ! site.jetpack ) {
			return this.renderNoJetpackSiteSelected();
		}

		if ( ! this.props.plugins.length ) {
			return this.renderNoJetpackPlan();
		}

		let turnOnManage;
		if ( ! site.canManage() ) {
			turnOnManage = (
				<Card className="plan-setup__need-manage">
					<p>{
						this.translate( '{{strong}}Jetpack Manage must be enabled for us to auto-configure your %(plan)s plan.{{/strong}} This will allow WordPress.com to communicate with your site and auto-configure the features unlocked with your new plan. Or you can opt out.', {
							args: { plan: site.plan.product_name_short },
							components: { strong: <strong /> }
						} )
					}</p>
					<Button primary>Enable Manage</Button>
					<Button>Manual Installation</Button>
				</Card>
			);
		}

		return (
			<div className="plan-setup">
				<h1 className="plan-setup__header">{ this.translate( 'Setting up your %(plan)s Plan', { args: { plan: site.plan.product_name_short } } ) }</h1>
				<p className="plan-setup__description">{ this.translate( 'We need to install a few plugins for you. It won\'t take long!' ) }</p>
				{ turnOnManage }
				{ turnOnManage
					? <FeatureExample>{ this.renderPlugins( true ) }</FeatureExample>
					: this.renderPlugins( false )
				}
			</div>
		);
	}
} );

export default connect(
	state => {
		const siteId = getSelectedSiteId( state );

		return {
			wporg: state.plugins.wporg.items,
			isRequesting: isRequesting( state, siteId ),
			isInstalling: isInstalling( state, siteId ),
			isFinished: isFinished( state, siteId ),
			plugins: getPluginsForSite( state, siteId ),
			activePlugin: getActivePlugin( state, siteId ),
			nextPlugin: getNextPlugin( state, siteId ),
			siteId
		};
	},
	dispatch => bindActionCreators( { fetchPluginData, fetchInstallInstructions, installPlugin }, dispatch )
)( PlansSetup );
