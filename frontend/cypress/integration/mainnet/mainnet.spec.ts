describe('Mainnet', () => {
    beforeEach(() => {
        cy.intercept('/api/block-height/*').as('block-height');
        cy.intercept('/api/block/*').as('block');
        cy.intercept('/api/block/*/txs/0').as('block-txs');
        cy.intercept('/api/tx/*/outspends').as('tx-outspends');

        // TODO: Fix ng serve to deliver this file
        cy.fixture('pools').then((json) => {
            cy.intercept('/resources/pools.json', json);
        });
    });

    it('loads the dashboard', () => {
      cy.visit('/');
      cy.wait(1000);
    });

    it('loads the blocks screen', () => {
        cy.visit('/');
        cy.get('li:nth-of-type(2) > a').click().then(() => {
           cy.wait(1000);
        });
    });

    it('loads the graphs screen', () => {
        cy.visit('/');
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    describe('tv mode', () => {
        it('loads the tv screen - desktop', () => {
            cy.viewport('macbook-16');
            cy.visit('/');
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.viewport('macbook-16');
                cy.wait(1000);
                cy.get('.blockchain-wrapper').should('be.visible');
            });
        });

        it('loads the tv screen - mobile', () => {
            cy.visit('/');
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.viewport('iphone-6');
                cy.wait(1000);
                cy.get('.blockchain-wrapper').should('not.be.visible');
            });
        });
    });


    it('loads the api screen', () => {
        cy.visit('/');
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    describe('blocks', () => {
        it('shows empty blocks properly', () => {
            cy.visit('/block/0000000000000000000bd14f744ef2e006e61c32214670de7eb891a5732ee775');
            cy.get('h2').invoke('text').should('equal', '1 transaction');
        });

        it('expands and collapses the block details', () => {
            cy.visit('/block/0');
            cy.wait('@tx-outspends');
            cy.get('.btn.btn-outline-info').click().then(() => {
                cy.get('#details').should('be.visible');
            });

            cy.get('.btn.btn-outline-info').click().then(() => {
                cy.get('#details').should('not.be.visible');
            });
        });

        it('shows blocks with no pagination', () => {
            cy.visit('/block/00000000000000000001ba40caf1ad4cec0ceb77692662315c151953bfd7c4c4');
            cy.get('h2').invoke('text').should('equal', '19 transactions');
            cy.get('ul.pagination').first().children().should('have.length', 5);
        });

        it('supports pagination on the block screen', () => {
            // 41 txs
            cy.visit('/block/00000000000000000009f9b7b0f63ad50053ad12ec3b7f5ca951332f134f83d8');
            cy.get('.header-bg.box > a').invoke('text').then((text1) => {
                cy.get('.active + li').first().click().then(() => {
                    cy.get('.header-bg.box > a').invoke('text').then((text2) => {
                        expect(text1).not.to.eq(text2);
                    });
                });
            });
        });
    });
});
