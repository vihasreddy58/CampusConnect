// utils.js
module.exports.getCategoryIcon = function getCategoryIcon(category) {
    let icon;
    switch (category) {
        case 'Technical':
            icon = '<i class="fas fa-cogs"></i>';
            break;
        case 'Cultural':
            icon = '<i class="fas fa-palette"></i>';
            break;
        case 'Literati':
            icon = '<i class="fas fa-book"></i>';
            break;
        case 'Sports':
            icon = '<i class="fas fa-football-ball"></i>';
            break;
        case 'Service':
            icon = '<i class="fas fa-hand-holding-heart"></i>';
            break;
        default:
            icon = '<i class="fas fa-question-circle"></i>';
    }
    return icon;
};
